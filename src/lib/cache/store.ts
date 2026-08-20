import { runtimeGet, runtimeSet } from './runtime';

/**
 * Two-tier cache with a stale fallback.
 *
 * L1 is an in-process Map: fastest, but per-instance and lost on every cold
 * start — which at crawl scale is the normal case.
 * L2 is the Vercel Runtime Cache: regional, shared across instances, and
 * persists across deployments, so a fresh deploy does not stampede the
 * upstream API.
 *
 * Both tiers store a soft expiry (when to refresh) alongside a longer hard
 * expiry (how long the value stays usable as a fallback). When the upstream
 * fails, a stale-but-correct value is served instead of an error. Scripture is
 * immutable, so a stale verse is indistinguishable from a fresh one.
 *
 * This is the only layer that provides that fallback. Vercel ignores
 * `stale-if-error`, so the CDN will not serve a known-good page through an
 * upstream failure however the response is labelled — see lib/http.ts.
 *
 * Loads are also single-flighted per key. A crawler arriving on a cold cache
 * asks for many distinct URLs at once, and Fluid Compute hands several of them
 * to the same instance; without this, two requests for the same chapter each
 * spend a call against a rate-limited app key to compute the same value.
 */

type Entry<T> = { value: T; soft: number; hard: number };

/** Bounded so a crawl over many chapters cannot grow the heap without limit. */
const MAX_LOCAL_ENTRIES = 500;

/** Vercel caps a Runtime Cache item at 2 MB; stay clear of the edge. */
const MAX_REMOTE_BYTES = 1_500_000;

const local = new Map<string, Entry<unknown>>();

/**
 * Loads currently in progress, keyed the same way as the cache itself.
 *
 * Per-instance, like L1: it collapses the duplicates one instance can see, not
 * the ones spread across the region. Entries remove themselves on settle, so
 * this never holds more than the concurrent miss count.
 */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Run `load` once per key, however many callers ask for it concurrently.
 *
 * Only the load is shared. Each caller still applies its own stale fallback on
 * rejection, so a shared failure degrades every waiter exactly as an unshared
 * one would.
 */
function singleFlight<T>(key: string, load: () => Promise<T>): Promise<T> {
	const existing = inFlight.get(key) as Promise<T> | undefined;
	if (existing) {
		return existing;
	}

	const pending = load().finally(() => {
		inFlight.delete(key);
	});
	inFlight.set(key, pending);
	return pending;
}

function localGet<T>(key: string): Entry<T> | undefined {
	const entry = local.get(key) as Entry<T> | undefined;
	if (!entry) {
		return undefined;
	}
	if (entry.hard < Date.now()) {
		local.delete(key);
		return undefined;
	}
	return entry;
}

function localSet<T>(key: string, value: T, ttlMs: number, graceMs: number): T {
	if (local.size >= MAX_LOCAL_ENTRIES && !local.has(key)) {
		const oldest = local.keys().next().value;
		if (oldest !== undefined) {
			local.delete(oldest);
		}
	}
	const now = Date.now();
	local.set(key, { value, soft: now + ttlMs, hard: now + ttlMs + graceMs });
	return value;
}

function isEnvelope<T>(value: unknown): value is Entry<T> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'value' in value &&
		'soft' in value &&
		'hard' in value
	);
}

async function remoteGet<T>(key: string): Promise<Entry<T> | undefined> {
	const raw = await runtimeGet(key);
	if (!isEnvelope<T>(raw)) {
		return undefined;
	}
	return raw.hard < Date.now() ? undefined : raw;
}

function remoteSet<T>(
	key: string,
	entry: Entry<T>,
	tags: string[],
	ttlSeconds: number,
): void {
	let payload: string;
	try {
		payload = JSON.stringify(entry);
	} catch {
		return;
	}
	if (payload.length > MAX_REMOTE_BYTES) {
		/**
		 * Loud, because a silent drop here is invisible and permanent.
		 *
		 * A key that never reaches L2 has no regional cache and no stale
		 * fallback — it lives only in the instance that loaded it, so every cold
		 * start pays a fresh upstream call and a throttled upstream takes the
		 * page down outright. `index:{versionId}` was exactly that for months:
		 * the NIV index serialises to 1.59 MB, so the home page and every reader
		 * page 503'd whenever the breaker was open, while passage-only pages
		 * carried on serving from cache. Anything oversized needs narrowing
		 * before it is cached, and the only way to know is to say so.
		 */
		console.warn(
			`[cache] ${key} not cached remotely: ${payload.length} bytes exceeds ${MAX_REMOTE_BYTES}`,
		);
		return;
	}

	runtimeSet(key, entry, ttlSeconds, tags);
}

/**
 * Fresh value, else L2, else load, else any stale value we still hold.
 *
 * @param ttlMs  how long the value is considered fresh
 * @param graceMs  how much longer it stays usable when the upstream is failing
 */
export async function loadCached<T>(
	key: string,
	ttlMs: number,
	graceMs: number,
	load: () => Promise<T>,
	tags: string[] = [],
): Promise<T> {
	const now = Date.now();

	const hit = localGet<T>(key);
	if (hit && hit.soft > now) {
		return hit.value;
	}

	const remote = await remoteGet<T>(key);
	if (remote && remote.soft > now) {
		localSet(key, remote.value, ttlMs, graceMs);
		return remote.value;
	}

	try {
		// Writes live inside the flight: N waiters on one load should produce one
		// set of cache writes, not N.
		return await singleFlight(key, async () => {
			const value = await load();
			const wrote = Date.now();
			localSet(key, value, ttlMs, graceMs);
			remoteSet(
				key,
				{ value, soft: wrote + ttlMs, hard: wrote + ttlMs + graceMs },
				tags,
				Math.ceil((ttlMs + graceMs) / 1000),
			);
			return value;
		});
	} catch (error) {
		// Stale beats a 503 — this is what keeps the site up through a 429.
		if (hit) {
			return hit.value;
		}
		if (remote) {
			return remote.value;
		}
		throw error;
	}
}

/**
 * Whatever we already hold for `key`, fresh or stale, without loading anything.
 *
 * For the callers whose answer is *nice to have*: a page that can state a
 * sensible default rather than spend a metered upstream call, and must not fail
 * if the cache is cold. `loadCached` cannot express that — asking it for a value
 * commits to fetching one.
 */
export async function peekCached<T>(key: string): Promise<T | undefined> {
	const hit = localGet<T>(key);
	if (hit) {
		return hit.value;
	}
	return (await remoteGet<T>(key))?.value;
}
