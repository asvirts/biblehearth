import { BOOK_IDS } from '@youversion/platform-core';

export type BookId = (typeof BOOK_IDS)[number];

export type BookMeta = {
	usfm: BookId;
	slug: string;
	name: string;
};

/**
 * Exported so the locale-aware lookups in lib/bible/books can treat English as
 * one more table rather than as the absence of one. Everything else should ask
 * those helpers, not read this: a caller that reaches in here is a caller that
 * only works in English.
 */
export const BOOK_META: readonly BookMeta[] = [
	{ usfm: 'GEN', slug: 'genesis', name: 'Genesis' },
	{ usfm: 'EXO', slug: 'exodus', name: 'Exodus' },
	{ usfm: 'LEV', slug: 'leviticus', name: 'Leviticus' },
	{ usfm: 'NUM', slug: 'numbers', name: 'Numbers' },
	{ usfm: 'DEU', slug: 'deuteronomy', name: 'Deuteronomy' },
	{ usfm: 'JOS', slug: 'joshua', name: 'Joshua' },
	{ usfm: 'JDG', slug: 'judges', name: 'Judges' },
	{ usfm: 'RUT', slug: 'ruth', name: 'Ruth' },
	{ usfm: '1SA', slug: '1-samuel', name: '1 Samuel' },
	{ usfm: '2SA', slug: '2-samuel', name: '2 Samuel' },
	{ usfm: '1KI', slug: '1-kings', name: '1 Kings' },
	{ usfm: '2KI', slug: '2-kings', name: '2 Kings' },
	{ usfm: '1CH', slug: '1-chronicles', name: '1 Chronicles' },
	{ usfm: '2CH', slug: '2-chronicles', name: '2 Chronicles' },
	{ usfm: 'EZR', slug: 'ezra', name: 'Ezra' },
	{ usfm: 'NEH', slug: 'nehemiah', name: 'Nehemiah' },
	{ usfm: 'EST', slug: 'esther', name: 'Esther' },
	{ usfm: 'JOB', slug: 'job', name: 'Job' },
	{ usfm: 'PSA', slug: 'psalms', name: 'Psalms' },
	{ usfm: 'PRO', slug: 'proverbs', name: 'Proverbs' },
	{ usfm: 'ECC', slug: 'ecclesiastes', name: 'Ecclesiastes' },
	{ usfm: 'SNG', slug: 'song-of-songs', name: 'Song of Songs' },
	{ usfm: 'ISA', slug: 'isaiah', name: 'Isaiah' },
	{ usfm: 'JER', slug: 'jeremiah', name: 'Jeremiah' },
	{ usfm: 'LAM', slug: 'lamentations', name: 'Lamentations' },
	{ usfm: 'EZK', slug: 'ezekiel', name: 'Ezekiel' },
	{ usfm: 'DAN', slug: 'daniel', name: 'Daniel' },
	{ usfm: 'HOS', slug: 'hosea', name: 'Hosea' },
	{ usfm: 'JOL', slug: 'joel', name: 'Joel' },
	{ usfm: 'AMO', slug: 'amos', name: 'Amos' },
	{ usfm: 'OBA', slug: 'obadiah', name: 'Obadiah' },
	{ usfm: 'JON', slug: 'jonah', name: 'Jonah' },
	{ usfm: 'MIC', slug: 'micah', name: 'Micah' },
	{ usfm: 'NAM', slug: 'nahum', name: 'Nahum' },
	{ usfm: 'HAB', slug: 'habakkuk', name: 'Habakkuk' },
	{ usfm: 'ZEP', slug: 'zephaniah', name: 'Zephaniah' },
	{ usfm: 'HAG', slug: 'haggai', name: 'Haggai' },
	{ usfm: 'ZEC', slug: 'zechariah', name: 'Zechariah' },
	{ usfm: 'MAL', slug: 'malachi', name: 'Malachi' },
	{ usfm: 'MAT', slug: 'matthew', name: 'Matthew' },
	{ usfm: 'MRK', slug: 'mark', name: 'Mark' },
	{ usfm: 'LUK', slug: 'luke', name: 'Luke' },
	{ usfm: 'JHN', slug: 'john', name: 'John' },
	{ usfm: 'ACT', slug: 'acts', name: 'Acts' },
	{ usfm: 'ROM', slug: 'romans', name: 'Romans' },
	{ usfm: '1CO', slug: '1-corinthians', name: '1 Corinthians' },
	{ usfm: '2CO', slug: '2-corinthians', name: '2 Corinthians' },
	{ usfm: 'GAL', slug: 'galatians', name: 'Galatians' },
	{ usfm: 'EPH', slug: 'ephesians', name: 'Ephesians' },
	{ usfm: 'PHP', slug: 'philippians', name: 'Philippians' },
	{ usfm: 'COL', slug: 'colossians', name: 'Colossians' },
	{ usfm: '1TH', slug: '1-thessalonians', name: '1 Thessalonians' },
	{ usfm: '2TH', slug: '2-thessalonians', name: '2 Thessalonians' },
	{ usfm: '1TI', slug: '1-timothy', name: '1 Timothy' },
	{ usfm: '2TI', slug: '2-timothy', name: '2 Timothy' },
	{ usfm: 'TIT', slug: 'titus', name: 'Titus' },
	{ usfm: 'PHM', slug: 'philemon', name: 'Philemon' },
	{ usfm: 'HEB', slug: 'hebrews', name: 'Hebrews' },
	{ usfm: 'JAS', slug: 'james', name: 'James' },
	{ usfm: '1PE', slug: '1-peter', name: '1 Peter' },
	{ usfm: '2PE', slug: '2-peter', name: '2 Peter' },
	{ usfm: '1JN', slug: '1-john', name: '1 John' },
	{ usfm: '2JN', slug: '2-john', name: '2 John' },
	{ usfm: '3JN', slug: '3-john', name: '3 John' },
	{ usfm: 'JUD', slug: 'jude', name: 'Jude' },
	{ usfm: 'REV', slug: 'revelation', name: 'Revelation' },
	{ usfm: 'TOB', slug: 'tobit', name: 'Tobit' },
	{ usfm: 'JDT', slug: 'judith', name: 'Judith' },
	{ usfm: 'ESG', slug: 'esther-greek', name: 'Esther (Greek)' },
	{ usfm: 'WIS', slug: 'wisdom', name: 'Wisdom' },
	{ usfm: 'SIR', slug: 'sirach', name: 'Sirach' },
	{ usfm: 'BAR', slug: 'baruch', name: 'Baruch' },
	{ usfm: 'LJE', slug: 'letter-of-jeremiah', name: 'Letter of Jeremiah' },
	{ usfm: 'S3Y', slug: 'song-of-three', name: 'Song of the Three Young Men' },
	{ usfm: 'SUS', slug: 'susanna', name: 'Susanna' },
	{ usfm: 'BEL', slug: 'bel-and-the-dragon', name: 'Bel and the Dragon' },
	{ usfm: '1MA', slug: '1-maccabees', name: '1 Maccabees' },
	{ usfm: '2MA', slug: '2-maccabees', name: '2 Maccabees' },
	{ usfm: '3MA', slug: '3-maccabees', name: '3 Maccabees' },
	{ usfm: '4MA', slug: '4-maccabees', name: '4 Maccabees' },
	{ usfm: '1ES', slug: '1-esdras', name: '1 Esdras' },
	{ usfm: '2ES', slug: '2-esdras', name: '2 Esdras' },
	{ usfm: 'MAN', slug: 'prayer-of-manasseh', name: 'Prayer of Manasseh' },
	{ usfm: 'PS2', slug: 'psalm-151', name: 'Psalm 151' },
	{ usfm: 'ODA', slug: 'odes', name: 'Odes' },
	{ usfm: 'PSS', slug: 'psalms-of-solomon', name: 'Psalms of Solomon' },
	{ usfm: '3ES', slug: '3-esdras', name: '3 Esdras' },
	{ usfm: 'EZA', slug: 'ezra-apocalypse', name: 'Apocalypse of Ezra' },
	{ usfm: '5EZ', slug: '5-ezra', name: '5 Ezra' },
	{ usfm: '6EZ', slug: '6-ezra', name: '6 Ezra' },
	{ usfm: 'DAG', slug: 'daniel-greek', name: 'Daniel (Greek)' },
	{ usfm: 'PS3', slug: 'psalms-152-155', name: 'Psalms 152–155' },
	{ usfm: '2BA', slug: '2-baruch', name: '2 Baruch' },
	{ usfm: 'LBA', slug: 'letter-of-baruch', name: 'Letter of Baruch' },
	{ usfm: 'JUB', slug: 'jubilees', name: 'Jubilees' },
	{ usfm: 'ENO', slug: 'enoch', name: 'Enoch' },
	{ usfm: '1MQ', slug: '1-meqabyan', name: '1 Meqabyan' },
	{ usfm: '2MQ', slug: '2-meqabyan', name: '2 Meqabyan' },
	{ usfm: '3MQ', slug: '3-meqabyan', name: '3 Meqabyan' },
	{ usfm: 'REP', slug: 'reproof', name: 'Reproof' },
	{ usfm: '4BA', slug: '4-baruch', name: '4 Baruch' },
	{ usfm: 'LAO', slug: 'laodiceans', name: 'Laodiceans' },
	{ usfm: 'LKA', slug: 'luke-acts', name: 'Luke–Acts' },
];

const byUsfm = new Map(BOOK_META.map((book) => [book.usfm, book]));
const bySlug = new Map(BOOK_META.map((book) => [book.slug, book]));
const knownIds = new Set<string>(BOOK_IDS);

export function isKnownBookId(usfm: string): usfm is BookId {
	return knownIds.has(usfm);
}

export function bookSlugFromUsfm(usfm: string): string {
	const id = usfm.toUpperCase();
	return byUsfm.get(id as BookId)?.slug ?? id.toLowerCase();
}

export function bookNameFromUsfm(usfm: string): string {
	const id = usfm.toUpperCase();
	return byUsfm.get(id as BookId)?.name ?? id;
}

/**
 * The book name as it reads in front of a chapter number.
 *
 * "Psalms" is the book; one of them is a "Psalm". Every publisher prints
 * "Psalm 23" and every reader types "psalm 23" — "Psalms 23" is a form nobody
 * writes, and it was the h2, the FAQ headings and the meta description on 150
 * of this site's chapters, which happen to be its highest-demand ones. No other
 * book of the Bible differs between the two positions, so this is the whole of
 * the special case.
 */
export function bookNameForChapter(usfm: string): string {
	return usfm.toUpperCase() === 'PSA' ? 'Psalm' : bookNameFromUsfm(usfm);
}

/**
 * The same rule, applied to a title that came from the Bible index rather than
 * from the table above.
 *
 * Reader pages show the publisher's own book title so a non-English version
 * reads in its own language. We have no grammar for singularising a title in a
 * language we do not know, so the rule is scoped to English and everything else
 * keeps the publisher's wording untouched.
 */
export function chapterBookTitle(
	bookId: string,
	title: string,
	languageTag = 'en',
): string {
	return bookId.toUpperCase() === 'PSA' &&
		languageTag.toLowerCase().startsWith('en')
		? 'Psalm'
		: title;
}

export function usfmFromBookSlug(slug: string): string | null {
	const exact = bySlug.get(slug);
	if (exact) {
		return exact.usfm;
	}

	const upper = slug.toUpperCase();
	if (isKnownBookId(upper)) {
		return upper;
	}

	return null;
}

/**
 * Is this the spelling of the book segment the site actually links with?
 *
 * `usfmFromBookSlug` accepts the raw USFM id as well as the slug, which is
 * convenient for a hand-typed URL and for anything holding only an id. The cost
 * is that `/psa/28` and `/psalms/28` are both live, and 102 of the 103 books
 * have an id that differs from their slug — so every `[book]` route in the site
 * exists twice.
 *
 * Callers redirect the alias rather than serving it. A canonical tag only asks
 * a crawler to consolidate the two; a 301 tells it, which is what Bing's
 * guidelines ask for and the only thing that stops the duplicate being crawled
 * at all. The redirect target is always built by a path helper, so the
 * canonical spelling has exactly one definition.
 */
export function isCanonicalBookSlug(slug: string, usfm: string): boolean {
	return bookSlugFromUsfm(usfm) === slug;
}

export function isIntroChapter(chapterId: string): boolean {
	return chapterId.toLowerCase().includes('intro');
}

export function isNumericChapter(chapterId: string): boolean {
	return /^\d+$/.test(chapterId);
}

export function isNumericVerse(verseId: string): boolean {
	return /^\d+$/.test(verseId);
}

export function isSafeSlug(value: string): boolean {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export type ParsedPassageId = {
	book: string;
	chapter?: string;
	verse?: string;
};

export function parsePassageId(passageId: string): ParsedPassageId | null {
	const parts = passageId.split('.');
	const book = parts[0]?.toUpperCase();
	if (!book || !isKnownBookId(book)) {
		return null;
	}

	const chapter = parts[1];
	const verse = parts[2];

	return {
		book,
		chapter,
		verse,
	};
}

export function chapterUsfm(book: string, chapter: string | number): string {
	return `${book.toUpperCase()}.${chapter}`;
}

export function verseUsfm(
	book: string,
	chapter: string | number,
	verse: string | number,
): string {
	return `${book.toUpperCase()}.${chapter}.${verse}`;
}
