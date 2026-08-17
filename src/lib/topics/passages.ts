import type { BiblePassage } from '@youversion/platform-core';
import { getPassageHtml } from '../youversion/api';

/**
 * Run tasks with a ceiling on how many are in flight.
 *
 * A topic cites a dozen or more passages. Firing them all at once turns one
 * page view into a burst against the YouVersion API, which is exactly how the
 * rate limit was tripped before. Results are cached after the first render, so
 * the cost of the cap is paid once.
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

export async function loadTopicPassages(
	versionId: number,
	refs: readonly string[],
): Promise<Map<string, BiblePassage | null>> {
	const unique = [...new Set(refs)];
	const loaded = await mapWithConcurrency(
		unique,
		4,
		async (usfm): Promise<LoadedPassage> => ({
			usfm,
			// A single missing passage must not take down the whole page.
			passage: await getPassageHtml(versionId, usfm, {
				headings: false,
				notes: false,
			}).catch(() => null),
		}),
	);

	return new Map(loaded.map((entry) => [entry.usfm, entry.passage]));
}
