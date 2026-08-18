import { runtimeGet, runtimeSet } from './runtime';

/**
 * A cooldown on upstream calls, so a rate limit cannot feed itself.
 *
 * The YouVersion rate limit is per app key and applies across every endpoint at
 * once — a 429 on the Verse of the Day means passages and the version catalog
 * are throttled too — and it answers `retry-after: 300`. Under a crawl the site
 * was making tens of requests a minute against an already-throttled key, every
 * one of them counting against the limit, so the key never got the quiet window
 * it was asking for. The CDN cannot absorb this either: Vercel only caches 200,
 * 404, 410 and redirects, so a 503 re-invokes the function every single time.
 * It has to be stopped here.
 *
 * Once tripped, no upstream call is attempted until the cooldown expires.
 * Cached values — including stale-but-usable ones — keep serving throughout, so
 * an open breaker degrades the site rather than blanking it. See `loadCached`.
 *
 * State lives in the Runtime Cache as well as in memory, because a crawl spreads
 * across many function instances and a purely in-process breaker would let every
 * new instance spend its own share of the limit before finding out.
 */

const KEY = 'breaker:upstream';

/**
 * Short relative to the 300s the API asks for: one probe a minute is enough to
 * notice recovery quickly while cutting request volume by two orders of
 * magnitude, and erring short only costs a handful of extra 429s.
 */
const COOLDOWN_MS = 60_000;

let openUntil = 0;

export async function isTripped(): Promise<boolean> {
	const now = Date.now();
	if (openUntil > now) {
		return true;
	}

	const shared = await runtimeGet(KEY);
	const until =
		typeof shared === 'object' && shared !== null && 'until' in shared
			? Number((shared as { until: unknown }).until)
			: 0;

	if (Number.isFinite(until) && until > now) {
		openUntil = until;
		return true;
	}

	return false;
}

export function trip(cooldownMs = COOLDOWN_MS): void {
	const until = Date.now() + cooldownMs;
	// Concurrent requests all see the same 429; only the one that extends the
	// cooldown is worth a cache write.
	if (until <= openUntil) {
		return;
	}
	openUntil = until;
	runtimeSet(KEY, { until }, Math.ceil(cooldownMs / 1000));
}
