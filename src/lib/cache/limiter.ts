/**
 * A ceiling on how many upstream calls this instance has in flight at once.
 *
 * The breaker in lib/cache/breaker.ts is a reaction: it needs a 429 before it
 * does anything. This is the matching precaution — it keeps a burst from
 * becoming that 429 in the first place. A crawler working through the sitemap
 * on a cold cache is the case that matters: Fluid Compute hands many of those
 * requests to one instance, and without a ceiling every one of them opens its
 * own upstream call the moment it arrives.
 *
 * Per-instance, so it bounds a burst rather than the region's total. That is
 * the honest limit of what can be enforced from inside a request without a
 * shared counter on every call — worth the round trip for the breaker, which
 * writes rarely, not for this, which would pay it on every passage fetch. Warm
 * caches keep the regional total low; see lib/cache/store.ts and the scheduled
 * warmer at pages/api/warm.ts.
 */

/**
 * Chosen to keep a single page render unblocked — a chapter needs three calls
 * (index, catalog, passage) and issues them together — while stopping a burst
 * of distinct URLs from fanning out without limit.
 */
const MAX_CONCURRENT = 4;

/**
 * How long a call waits for a slot before giving up.
 *
 * Queuing is only worth it while the wait is shorter than the work. Past this
 * the caller is better off failing to `loadCached`, which has a stale value for
 * most keys and will serve it; holding the request instead just walks it into
 * the function timeout with nothing to show.
 */
const MAX_WAIT_MS = 4_000;

export class UpstreamBusyError extends Error {
	constructor() {
		super('Upstream call queue is saturated');
		this.name = 'UpstreamBusyError';
	}
}

let active = 0;
const waiting: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

function release(): void {
	const next = waiting.shift();
	if (next) {
		// Hand the slot straight over rather than decrementing: releasing and
		// re-acquiring would let a caller that arrived later jump the queue.
		next.resolve();
		return;
	}
	active -= 1;
}

function acquire(): Promise<void> {
	if (active < MAX_CONCURRENT) {
		active += 1;
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		const entry = {
			resolve: () => {
				clearTimeout(timer);
				resolve();
			},
			reject,
		};

		const timer = setTimeout(() => {
			const index = waiting.indexOf(entry);
			if (index !== -1) {
				waiting.splice(index, 1);
			}
			reject(new UpstreamBusyError());
		}, MAX_WAIT_MS);

		// Node keeps the event loop alive for a pending timer, which on a
		// serverless instance is time billed for waiting on nothing. Typed
		// through the DOM's `setTimeout`, which returns a plain number, so the
		// Node-only method has to be reached for rather than called outright.
		(timer as unknown as { unref?: () => void }).unref?.();

		waiting.push(entry);
	});
}

/** Run `operation` once a slot is free, or throw `UpstreamBusyError` waiting. */
export async function limitUpstream<T>(operation: () => Promise<T>): Promise<T> {
	await acquire();
	try {
		return await operation();
	} finally {
		release();
	}
}
