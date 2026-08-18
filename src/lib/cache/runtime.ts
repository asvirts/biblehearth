import { getCache, waitUntil } from '@vercel/functions';

/**
 * Access to the Vercel Runtime Cache.
 *
 * Regional, shared across function instances, and it survives deployments —
 * which is what stops a fresh deploy from stampeding the upstream API. It is
 * absent outside a Vercel function (a plain `astro build`, or `astro dev`), so
 * every caller has to stay correct without it.
 */

type RuntimeCacheLike = {
	get: (key: string) => Promise<unknown | null>;
	set: (
		key: string,
		value: unknown,
		options?: { name?: string; tags?: string[]; ttl?: number },
	) => Promise<void>;
};

let cache: RuntimeCacheLike | null | undefined;

function runtimeCache(): RuntimeCacheLike | null {
	if (cache !== undefined) {
		return cache;
	}
	try {
		cache = getCache({ namespace: 'biblehearth' }) as RuntimeCacheLike;
	} catch {
		cache = null;
	}
	return cache;
}

/** Never throws: an unavailable cache has to read as a miss, not as an error. */
export async function runtimeGet(key: string): Promise<unknown | null> {
	const store = runtimeCache();
	if (!store) {
		return null;
	}
	try {
		return await store.get(key);
	} catch {
		return null;
	}
}

/**
 * Fire-and-forget write.
 *
 * Writing must never add latency to the response and a cache failure must never
 * fail the request, so the promise goes to `waitUntil` rather than being
 * awaited.
 */
export function runtimeSet(
	key: string,
	value: unknown,
	ttlSeconds: number,
	tags: string[] = [],
): void {
	const store = runtimeCache();
	if (!store) {
		return;
	}

	const write = store.set(key, value, { tags, ttl: ttlSeconds }).catch(() => {});
	try {
		waitUntil(write);
	} catch {
		void write;
	}
}
