import type { BookId } from '../usfm';

/**
 * One book of the Bible as one locale spells it.
 *
 * `name` is the publisher's title, used in prose and headings; `slug` is that
 * title reduced to a path segment. Both are generated together so they cannot
 * disagree — see scripts/generate-book-slugs.mjs.
 */
export type LocalizedBook = {
	usfm: BookId;
	slug: string;
	name: string;
};
