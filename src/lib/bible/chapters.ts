/**
 * Chapter counts for the 66-book Protestant canon.
 *
 * Hard-coded rather than read from a Bible index, for two reasons. It makes
 * every study route validate its own bounds without an upstream call, so
 * `/genesis/51` is a 404 even while the scripture API is throttled.
 * And it defines the canon these routes cover: the commentaries we republish
 * were written against this list, and Tyndale's notes reaching into the
 * deuterocanon is not a reason to open sixty extra routes nobody wrote a summary
 * for.
 *
 * Chapter counts are fixed by the versification these translations share. Verse
 * counts are not — they differ between translations — which is why only chapters
 * live here.
 */
export const CHAPTER_COUNTS: Readonly<Record<string, number>> = {
	GEN: 50, EXO: 40, LEV: 27, NUM: 36, DEU: 34, JOS: 24, JDG: 21, RUT: 4,
	'1SA': 31, '2SA': 24, '1KI': 22, '2KI': 25, '1CH': 29, '2CH': 36,
	EZR: 10, NEH: 13, EST: 10, JOB: 42, PSA: 150, PRO: 31, ECC: 12, SNG: 8,
	ISA: 66, JER: 52, LAM: 5, EZK: 48, DAN: 12, HOS: 14, JOL: 3, AMO: 9,
	OBA: 1, JON: 4, MIC: 7, NAM: 3, HAB: 3, ZEP: 3, HAG: 2, ZEC: 14, MAL: 4,
	MAT: 28, MRK: 16, LUK: 24, JHN: 21, ACT: 28, ROM: 16, '1CO': 16, '2CO': 13,
	GAL: 6, EPH: 6, PHP: 4, COL: 4, '1TH': 5, '2TH': 3, '1TI': 6, '2TI': 4,
	TIT: 3, PHM: 1, HEB: 13, JAS: 5, '1PE': 5, '2PE': 3, '1JN': 5, '2JN': 1,
	'3JN': 1, JUD: 1, REV: 22,
};

/** Canon order, for book listings that should not be alphabetical. */
export const CANON_ORDER: readonly string[] = Object.keys(CHAPTER_COUNTS);

/** Where the New Testament starts, for splitting a book index in two. */
const NT_START = CANON_ORDER.indexOf('MAT');

export function isCanonicalBook(bookUsfm: string): boolean {
	return bookUsfm in CHAPTER_COUNTS;
}

export function chapterCount(bookUsfm: string): number {
	return CHAPTER_COUNTS[bookUsfm] ?? 0;
}

export function chapterInRange(
	bookUsfm: string,
	chapter: string | number,
): boolean {
	const total = chapterCount(bookUsfm);
	const n = Number(chapter);
	return total > 0 && Number.isInteger(n) && n >= 1 && n <= total;
}

export function isOldTestament(bookUsfm: string): boolean {
	const index = CANON_ORDER.indexOf(bookUsfm);
	return index >= 0 && index < NT_START;
}

export const OLD_TESTAMENT_BOOKS = CANON_ORDER.slice(0, NT_START);
export const NEW_TESTAMENT_BOOKS = CANON_ORDER.slice(NT_START);

/** 1,189 in the shared versification. Guards a typo in the table above. */
export const TOTAL_CHAPTERS = Object.values(CHAPTER_COUNTS).reduce(
	(sum, count) => sum + count,
	0,
);
