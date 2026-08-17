import { getCache, waitUntil } from '@vercel/functions';

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
 */

type Entry<T> = { value: T; soft: number; hard: number };

/** Bounded so a crawl over many chapters cannot grow the heap without limit. */
const MAX_LOCAL_ENTRIES = 500;

/** Vercel caps a Runtime Cache item at 2 MB; stay clear of the edge. */
const MAX_REMOTE_BYTES = 1_500_000;

const local = new Map<string, Entry<unknown>>();

type RuntimeCacheLike = {
	get: (key: string) => Promise<unknown | null>;
	set: (
		key: string,
		value: unknown,
		options?: { name?: string; tags?: string[]; ttl?: number },
	) => Promise<void>;
};

let runtime: RuntimeCacheLike | null | undefined;

function runtimeCache(): RuntimeCacheLike | null {
	if (runtime !== undefined) {
		return runtime;
	}
	try {
		runtime = getCache({ namespace: 'biblehearth' }) as RuntimeCacheLike;
	} catch {
		// No cache in this context (e.g. plain `astro build`). L1 still applies.
		runtime = null;
	}
	return runtime;
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
	const cache = runtimeCache();
	if (!cache) {
		return undefined;
	}
	try {
		const raw = await cache.get(key);
		if (!isEnvelope<T>(raw)) {
			return undefined;
		}
		return raw.hard < Date.now() ? undefined : raw;
	} catch {
		return undefined;
	}
}

function remoteSet<T>(
	key: string,
	entry: Entry<T>,
	tags: string[],
	ttlSeconds: number,
): void {
	const cache = runtimeCache();
	if (!cache) {
		return;
	}

	let payload: string;
	try {
		payload = JSON.stringify(entry);
	} catch {
		return;
	}
	if (payload.length > MAX_REMOTE_BYTES) {
		return;
	}

	// Writing must never add latency to the response, and a cache failure must
	// never fail the request.
	const write = cache.set(key, entry, { tags, ttl: ttlSeconds }).catch(() => {});
	try {
		waitUntil(write);
	} catch {
		void write;
	}
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
		const value = await load();
		localSet(key, value, ttlMs, graceMs);
		remoteSet(
			key,
			{ value, soft: now + ttlMs, hard: now + ttlMs + graceMs },
			tags,
			Math.ceil((ttlMs + graceMs) / 1000),
		);
		return value;
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
