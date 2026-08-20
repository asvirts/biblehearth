/**
 * A book title reduced to a path segment, in whatever script it is written in.
 *
 * Non-Latin scripts keep their own characters — `/ko/시편/91`, `/ar/مزمور/91`,
 * `/ta/சங்கீதம்/91`. A transliteration would be a spelling we invented, which is
 * the one thing a URL segment must never be: nobody searches it and nobody can
 * guess it.
 *
 * The hard part is combining marks, because whether a mark is noise or a letter
 * depends entirely on the script. Stripping all of them — which is what one
 * `NFD` and one `\p{M}` pass does — turns Génesis into genesis and الأمثال into
 * الامثال, both wanted, and then turns ஆதியாகமம் into ஆதயகமம and เลวีนิติ into
 * เลวนต, which are not words. Tamil and Thai vowel signs are marks in Unicode
 * and letters in the language.
 *
 * So marks are removed only where the script says they are decoration:
 *
 * - **Latin** diacritics, because `genese` and `genèse` must be one URL.
 * - **Arabic** harakat and tatweel, which are optional pointing, plus the hamza
 *   carriers (أ إ آ ٱ → ا), which readers type interchangeably. Sorani Kurdish
 *   is unaffected: its vowels are letters (ە, ێ), not marks.
 * - **Hebrew** niqqud, which is optional pointing on the same terms.
 *
 * Everything else — Devanagari, Bengali, Tamil, Malayalam, Thai, Ethiopic,
 * Hangul, Han — keeps every mark it arrived with.
 *
 * Letters that merely look like accented Latin but have no decomposition survive
 * as themselves: Danish ø, Polish ł, Éwé ɖ. There is nothing to strip and no
 * honest ASCII to strip them to.
 *
 * Used twice, and that is the point. The generator spells the canonical slug
 * with it, and slug lookup runs incoming segments through it before matching —
 * so a URL that arrives with the hamza still on it, or NFD-decomposed by a copy
 * out of macOS, resolves to the same book and redirects to the canonical
 * spelling instead of 404ing.
 */

/** Optional Arabic pointing, and the tatweel used only to stretch a word. */
const ARABIC_MARKS = /[ً-ْٰـ]/g;

/** Alef with any hamza or madda, which readers type as a bare alef. */
const ARABIC_ALEF_VARIANTS = /[أإآٱ]/g;

/** Hebrew niqqud, cantillation and the shin/sin dots — all optional pointing. */
const HEBREW_POINTS = /[֑-ׇֽֿׁׂׅׄ]/g;

/** A Latin letter and whatever marks follow it, precomposed or not. */
const LATIN_WITH_MARKS = /\p{Script=Latin}\p{M}*/gu;

/**
 * Joiners that shape a conjunct without being visible.
 *
 * Dropped rather than hyphenated: they carry no information a URL can show, and
 * turning an invisible character into a visible hyphen invents a word break
 * inside a Malayalam or Persian word.
 */
const INVISIBLE_JOINERS = /[\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Anything that is not part of a word, in any script.
 *
 * `\p{M}` belongs in the keep-set and this is the whole reason the first version
 * of this function was wrong. A Tamil vowel sign is a Mark, not a Letter, so a
 * class of `[^\p{L}\p{N}]` hyphenated every vowel in the language:
 * ஆதியாகமம் came out as `ஆத-ய-கமம`. By the time this runs, every mark that was
 * decoration has already been removed above, so the marks that reach here are
 * letters in all but Unicode's naming.
 */
const NON_WORD = /[^\p{L}\p{N}\p{M}]+/gu;

export function slugifyBookTitle(title: string): string {
	return title
		.normalize('NFC')
		.replace(ARABIC_MARKS, '')
		.replace(ARABIC_ALEF_VARIANTS, 'ا')
		.replace(HEBREW_POINTS, '')
		.replace(LATIN_WITH_MARKS, (run) =>
			run.normalize('NFD').replace(/\p{M}+/gu, ''),
		)
		.replace(INVISIBLE_JOINERS, '')
		.toLowerCase()
		.replace(NON_WORD, '-')
		.replace(/^-+|-+$/g, '');
}
