import type { BiblePassage } from '@youversion/platform-core';
import { getPassageHtml } from '../youversion/api';

/**
 * Run tasks with a ceiling on how many are in flight.
 *
 * A topic or answer page cites a dozen or more passages. Firing them all at
 * once turns one page view into a burst against the YouVersion API, which is
 * exactly how the rate limit was tripped before. Results are cached after the
 * first render, so the cost of the cap is paid once.
 */
async function mapWithConcurrency<T, R>(
	items: readonly T[],
	limit: number,
	task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let cursor = 0;

	const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
		(async () => {
			while (cursor < items.length) {
				const index = cursor;
				cursor += 1;
				const item = items[index];
				if (item !== undefined) {
					results[index] = await task(item, index);
				}
			}
		})(),
	);

	await Promise.all(workers);
	return results;
}

export type LoadedPassage = {
	usfm: string;
	passage: BiblePassage | null;
};

export type LoadedPassages = {
	passages: Map<string, BiblePassage | null>;
	/**
	 * How many passages could not be fetched, as opposed to not existing.
	 *
	 * `getPassageHtml` answers null for text the upstream does not have and throws
	 * when it could not ask. Both come back from here as null, so that one missing
	 * quotation cannot take a page down, but only the second is temporary — and a
	 * page has to know which it is looking at. Cached as though it were complete, a
	 * page whose verses failed to load is served without them for a day; see
	 * `DEGRADED_CACHE_CONTROL`.
	 */
	failed: number;
};

export async function loadPassages(
	versionId: number,
	refs: readonly string[],
): Promise<LoadedPassages> {
	const unique = [...new Set(refs)];
	let failed = 0;
	const loaded = await mapWithConcurrency(
		unique,
		4,
		async (usfm): Promise<LoadedPassage> => ({
			usfm,
			// A single missing passage must not take down the whole page.
			passage: await getPassageHtml(versionId, usfm, {
				headings: false,
				notes: false,
			}).catch(() => {
				failed += 1;
				return null;
			}),
		}),
	);

	return {
		passages: new Map(loaded.map((entry) => [entry.usfm, entry.passage])),
		failed,
	};
}
