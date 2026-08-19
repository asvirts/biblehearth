import { bookNameForChapter, bookNameFromUsfm } from './usfm';

/**
 * Expand a reference into the individual verses it covers.
 *
 * `PHP.4.6-7` → `PHP.4.6`, `PHP.4.7`. A chapter-only reference (`PHP.4`)
 * expands to itself, since we cannot know its length without the index.
 */
export function expandUsfm(usfm: string): string[] {
	const parts = usfm.split('.');
	const [book, chapter, verse] = parts;
	if (!book || !chapter || !verse) {
		return [usfm];
	}

	const range = verse.split('-');
	const start = Number(range[0]);
	const end = range[1] === undefined ? start : Number(range[1]);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
		return [usfm];
	}

	const out: string[] = [];
	for (let n = start; n <= end && out.length < 200; n += 1) {
		out.push(`${book}.${chapter}.${n}`);
	}
	return out;
}

export function chapterOf(usfm: string): string {
	const [book, chapter] = usfm.split('.');
	return book && chapter ? `${book}.${chapter}` : usfm;
}

/**
 * A human-readable reference for a USFM id, using the app's book names.
 * `PHP.4.6-7` → `Philippians 4:6-7`.
 */
export function formatReference(usfm: string): string {
	const [book, chapter, verse] = usfm.split('.');
	if (!book) {
		return usfm;
	}
	if (!chapter) {
		return bookNameFromUsfm(book);
	}
	// `Psalms` on its own, `Psalm 23` in front of a number. See usfm.ts.
	const name = bookNameForChapter(book);
	return verse ? `${name} ${chapter}:${verse}` : `${name} ${chapter}`;
}

/** "Psalm 28", "Genesis 1" — a chapter written the way a reader writes it. */
export function chapterReference(
	bookUsfm: string,
	chapter: string | number,
): string {
	return `${bookNameForChapter(bookUsfm)} ${chapter}`;
}

/**
 * Reverse index: which editorial pages cite a given verse or chapter.
 *
 * This is the half of the internal-link graph that turns leaf reader pages from
 * crawl-budget consumers into link donors. Both the topic pages and the answer
 * pages need exactly this, and both must compute it rather than hand-keep it —
 * a hand-kept list goes stale the first time a citation changes.
 *
 * `key` deduplicates: one page citing `GEN.6.1-4` must appear once against
 * `GEN.6`, not four times.
 */
export function referenceIndex<T>(
	entries: readonly { ref: T; usfms: readonly string[] }[],
	key: (ref: T) => string,
): { byVerse: Map<string, T[]>; byChapter: Map<string, T[]> } {
	const byVerse = new Map<string, T[]>();
	const byChapter = new Map<string, T[]>();

	const push = (map: Map<string, T[]>, id: string, ref: T) => {
		const existing = map.get(id);
		if (!existing) {
			map.set(id, [ref]);
			return;
		}
		if (!existing.some((item) => key(item) === key(ref))) {
			existing.push(ref);
		}
	};

	for (const entry of entries) {
		for (const usfm of entry.usfms) {
			for (const single of expandUsfm(usfm)) {
				push(byVerse, single, entry.ref);
				push(byChapter, chapterOf(single), entry.ref);
			}
		}
	}

	return { byVerse, byChapter };
}
