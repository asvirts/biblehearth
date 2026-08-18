import { bookSlugFromUsfm } from '../bible/usfm';

/**
 * Outbound "go deeper" links to commentaries we may not republish.
 *
 * The Gospel Coalition's commentary and BibleProject's videos are both free to
 * read and both excellent for a new reader — and neither is openly licensed.
 * TGC grants unaltered excerpts with a backlink; BibleProject's terms forbid
 * derivative works outright while explicitly permitting embeds and links. So
 * they are linked, not reproduced. That is the correct reading of both licences
 * and it is also the better SEO outcome: a page that republishes another site's
 * text competes with it, while a page that cites it earns the topical company.
 *
 * Every URL below was checked against the live site rather than derived from a
 * pattern, because both publishers break the obvious pattern. TGC splits Psalms
 * into the five books of the Psalter and calls Song of Songs "Song of Solomon".
 * BibleProject splits ten books into two-part overviews and merges Kings,
 * Chronicles, Ezra-Nehemiah and 1-3 John into single videos. A slug guessed from
 * a book name is a 404 roughly a third of the time.
 */

export type ExternalStudyLink = {
	/** Link text. Says what the thing is, not "click here". */
	label: string;
	href: string;
	publisher: string;
	/** One line on why a reader would want it. */
	note: string;
};

/** Chapter ranges where a publisher splits or merges a book. */
type SplitEntry = { upTo: number; slug: string };

/**
 * The Psalter's five books, which is how TGC divides its Psalms commentary.
 * The boundaries are the traditional ones, not TGC's invention.
 */
const TGC_PSALM_BOOKS: readonly SplitEntry[] = [
	{ upTo: 41, slug: 'psalm-1-psalm-41' },
	{ upTo: 72, slug: 'psalm-42-psalm-72' },
	{ upTo: 89, slug: 'psalm-73-psalm-89' },
	{ upTo: 106, slug: 'psalm-90-psalm-106' },
	{ upTo: 150, slug: 'psalm-107-psalm-150' },
];

function tgcSlug(bookUsfm: string, chapter: number): string | null {
	if (bookUsfm === 'PSA') {
		return (
			TGC_PSALM_BOOKS.find((entry) => chapter <= entry.upTo)?.slug ?? null
		);
	}
	if (bookUsfm === 'SNG') {
		return 'song-of-solomon';
	}
	// Every other book matches this site's own slug exactly.
	const slug = bookSlugFromUsfm(bookUsfm);
	return TGC_BOOKS.has(slug) ? slug : null;
}

/** Verified against the commentary index. Deuterocanon is absent by design. */
const TGC_BOOKS = new Set([
	'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy', 'joshua',
	'judges', 'ruth', '1-samuel', '2-samuel', '1-kings', '2-kings',
	'1-chronicles', '2-chronicles', 'ezra', 'nehemiah', 'esther', 'job',
	'proverbs', 'ecclesiastes', 'isaiah', 'jeremiah', 'lamentations', 'ezekiel',
	'daniel', 'hosea', 'joel', 'amos', 'obadiah', 'jonah', 'micah', 'nahum',
	'habakkuk', 'zephaniah', 'haggai', 'zechariah', 'malachi', 'matthew', 'mark',
	'luke', 'john', 'acts', 'romans', '1-corinthians', '2-corinthians',
	'galatians', 'ephesians', 'philippians', 'colossians', '1-thessalonians',
	'2-thessalonians', '1-timothy', '2-timothy', 'titus', 'philemon', 'hebrews',
	'james', '1-peter', '2-peter', '1-john', '2-john', '3-john', 'jude',
	'revelation',
]);

/**
 * BibleProject book-overview video slugs.
 *
 * A single string is one video for the whole book. An array is a book they cover
 * in parts, matched by chapter, so a reader on Genesis 40 gets the video that
 * actually covers Genesis 40 rather than the one about chapters 1–11.
 */
const BIBLE_PROJECT: Readonly<Record<string, string | readonly SplitEntry[]>> = {
	GEN: [{ upTo: 11, slug: 'genesis-1-11' }, { upTo: 50, slug: 'genesis-12-50' }],
	EXO: [{ upTo: 18, slug: 'exodus-1-18' }, { upTo: 40, slug: 'exodus-19-40' }],
	LEV: 'leviticus',
	NUM: 'numbers',
	DEU: 'deuteronomy',
	JOS: 'joshua',
	JDG: 'judges',
	RUT: 'ruth',
	'1SA': '1-samuel',
	'2SA': '2-samuel',
	// Kings and Chronicles each get one video covering both halves.
	'1KI': 'kings',
	'2KI': 'kings',
	'1CH': 'chronicles',
	'2CH': 'chronicles',
	EZR: 'ezra-nehemiah',
	NEH: 'ezra-nehemiah',
	EST: 'esther',
	JOB: 'job',
	PSA: 'psalms',
	PRO: 'proverbs',
	ECC: 'ecclesiastes',
	SNG: 'song-songs',
	ISA: [{ upTo: 39, slug: 'isaiah-1-39' }, { upTo: 66, slug: 'isaiah-40-66' }],
	JER: 'jeremiah',
	LAM: 'lamentations',
	EZK: [{ upTo: 33, slug: 'ezekiel-1-33' }, { upTo: 48, slug: 'ezekiel-34-48' }],
	DAN: 'daniel',
	HOS: 'hosea',
	JOL: 'joel',
	AMO: 'amos',
	OBA: 'obadiah',
	JON: 'jonah',
	MIC: 'micah',
	NAM: 'nahum',
	HAB: 'habakkuk',
	ZEP: 'zephaniah',
	HAG: 'haggai',
	ZEC: 'zechariah',
	MAL: 'malachi',
	MAT: [
		{ upTo: 13, slug: 'matthew-1-13' },
		{ upTo: 28, slug: 'matthew-14-28' },
	],
	MRK: 'mark',
	LUK: [{ upTo: 9, slug: 'luke-1-9' }, { upTo: 24, slug: 'luke-10-24' }],
	JHN: [{ upTo: 12, slug: 'john-1-12' }, { upTo: 21, slug: 'john-13-21' }],
	ACT: [{ upTo: 12, slug: 'acts-1-12' }, { upTo: 28, slug: 'acts-13-28' }],
	ROM: [{ upTo: 4, slug: 'romans-1-4' }, { upTo: 16, slug: 'romans-5-16' }],
	'1CO': '1-corinthians',
	'2CO': '2-corinthians',
	GAL: 'galatians',
	EPH: 'ephesians',
	PHP: 'philippians',
	COL: 'colossians',
	'1TH': '1-thessalonians',
	'2TH': '2-thessalonians',
	'1TI': '1-timothy',
	'2TI': '2-timothy',
	TIT: 'titus',
	PHM: 'philemon',
	HEB: 'hebrews',
	JAS: 'james',
	'1PE': '1-peter',
	'2PE': '2-peter',
	// One video covers all three letters of John.
	'1JN': '1-3-john',
	'2JN': '1-3-john',
	'3JN': '1-3-john',
	JUD: 'jude',
	REV: [
		{ upTo: 11, slug: 'revelation-1-11' },
		{ upTo: 22, slug: 'revelation-12-22' },
	],
};

function bibleProjectSlug(bookUsfm: string, chapter: number): string | null {
	const entry = BIBLE_PROJECT[bookUsfm];
	if (!entry) {
		return null;
	}
	if (typeof entry === 'string') {
		return entry;
	}
	return entry.find((part) => chapter <= part.upTo)?.slug ?? null;
}

/**
 * Where to send a reader who wants more than this page holds.
 *
 * Returns only links verified to exist. A book outside either publisher's
 * coverage simply yields fewer links — never a fabricated one, which is the
 * failure a reader remembers.
 */
export function externalStudyLinks(
	bookUsfm: string,
	chapter: number,
): ExternalStudyLink[] {
	const links: ExternalStudyLink[] = [];

	const tgc = tgcSlug(bookUsfm, chapter);
	if (tgc) {
		links.push({
			label: 'The Gospel Coalition Bible Commentary',
			href: `https://www.thegospelcoalition.org/commentary/${tgc}/`,
			publisher: 'The Gospel Coalition',
			note: 'A free, modern, chapter-by-chapter commentary written by working pastors and scholars. The closest thing to a current study Bible you can read online at no cost.',
		});
	}

	const video = bibleProjectSlug(bookUsfm, chapter);
	if (video) {
		links.push({
			label: 'BibleProject book overview video',
			href: `https://bibleproject.com/videos/${video}/`,
			publisher: 'BibleProject',
			note: 'An animated eight-minute walkthrough of the whole book, tracing how its parts fit together. The fastest way to see where this chapter sits in the larger story.',
		});
	}

	return links;
}
