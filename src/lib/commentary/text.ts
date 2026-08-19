import { bookSlugFromUsfm } from '../bible/usfm';

/**
 * Turn commentary plain text into paragraphs of safe HTML, with the scripture
 * references inside it linked.
 *
 * The linking is the point. These commentaries cross-reference constantly —
 * Henry alone cites five other books in his first paragraph on Genesis 1 — and
 * a reference a reader cannot follow is a dead end for a newcomer and a wasted
 * internal link for the site. Every ref becomes a real link to a page we own.
 *
 * Two rules govern the abbreviation table below, both learned the hard way:
 *
 * 1. Ambiguity loses. `Jud` is Judges to some editors and Jude to others, so it
 *    is absent — an unlinked reference costs a click, a wrong one costs trust.
 *    Two-letter forms (`Is`, `Ro`, `Ge`, `Mt`) are absent for the same reason:
 *    they collide with ordinary English words. `Ps` is the sole exception,
 *    because it is overwhelmingly common and never appears before a number by
 *    accident.
 * 2. Reversed forms are real. Jamieson-Fausset-Brown, following the Sword
 *    module convention it was digitised from, writes `Pe1 2:25` and `Jo1 4:8`.
 *    Leave those out and the 1871 commentary loses most of its cross-links.
 */

/** Alias → USFM book id. Spaces in an alias match optional whitespace. */
const BOOK_ALIASES: Readonly<Record<string, string>> = {
	gen: 'GEN', genesis: 'GEN',
	exo: 'EXO', exod: 'EXO', exodus: 'EXO',
	lev: 'LEV', leviticus: 'LEV',
	num: 'NUM', numb: 'NUM', numbers: 'NUM',
	deu: 'DEU', deut: 'DEU', deuteronomy: 'DEU',
	jos: 'JOS', josh: 'JOS', joshua: 'JOS',
	jdg: 'JDG', judg: 'JDG', judges: 'JDG',
	rut: 'RUT', ruth: 'RUT',
	'1 sa': '1SA', '1 sam': '1SA', '1 samuel': '1SA', sa1: '1SA',
	'2 sa': '2SA', '2 sam': '2SA', '2 samuel': '2SA', sa2: '2SA',
	'1 ki': '1KI', '1 kin': '1KI', '1 kgs': '1KI', '1 kings': '1KI', ki1: '1KI',
	kg1: '1KI',
	'2 ki': '2KI', '2 kin': '2KI', '2 kgs': '2KI', '2 kings': '2KI', ki2: '2KI',
	kg2: '2KI',
	'1 ch': '1CH', '1 chr': '1CH', '1 chron': '1CH', '1 chronicles': '1CH', ch1: '1CH',
	'2 ch': '2CH', '2 chr': '2CH', '2 chron': '2CH', '2 chronicles': '2CH', ch2: '2CH',
	ezr: 'EZR', ezra: 'EZR',
	neh: 'NEH', nehemiah: 'NEH',
	est: 'EST', esth: 'EST', esther: 'EST',
	job: 'JOB',
	psa: 'PSA', ps: 'PSA', pss: 'PSA', psm: 'PSA', psalm: 'PSA', psalms: 'PSA',
	pro: 'PRO', prov: 'PRO', prv: 'PRO', proverbs: 'PRO',
	ecc: 'ECC', eccl: 'ECC', eccles: 'ECC', ecclesiastes: 'ECC',
	sng: 'SNG', song: 'SNG', sos: 'SNG', 'song of songs': 'SNG',
	'song of solomon': 'SNG', 'song of sol': 'SNG', canticles: 'SNG',
	isa: 'ISA', isaiah: 'ISA',
	jer: 'JER', jeremiah: 'JER',
	lam: 'LAM', lamentations: 'LAM',
	ezk: 'EZK', eze: 'EZK', ezek: 'EZK', ezekiel: 'EZK',
	dan: 'DAN', daniel: 'DAN',
	hos: 'HOS', hosea: 'HOS',
	jol: 'JOL', joe: 'JOL', joel: 'JOL',
	amo: 'AMO', amos: 'AMO',
	oba: 'OBA', obad: 'OBA', obadiah: 'OBA',
	jon: 'JON', jonah: 'JON',
	mic: 'MIC', micah: 'MIC',
	nam: 'NAM', nah: 'NAM', nahum: 'NAM',
	hab: 'HAB', habakkuk: 'HAB',
	zep: 'ZEP', zeph: 'ZEP', zephaniah: 'ZEP',
	hag: 'HAG', haggai: 'HAG',
	zec: 'ZEC', zac: 'ZEC', zech: 'ZEC', zechariah: 'ZEC',
	mal: 'MAL', malachi: 'MAL',
	mat: 'MAT', matt: 'MAT', matthew: 'MAT',
	mrk: 'MRK', mar: 'MRK', mark: 'MRK',
	luk: 'LUK', luke: 'LUK',
	joh: 'JHN', jhn: 'JHN', john: 'JHN',
	act: 'ACT', acts: 'ACT',
	rom: 'ROM', romans: 'ROM',
	'1 co': '1CO', '1 cor': '1CO', '1 corinthians': '1CO', co1: '1CO',
	'2 co': '2CO', '2 cor': '2CO', '2 corinthians': '2CO', co2: '2CO',
	gal: 'GAL', galatians: 'GAL',
	eph: 'EPH', ephesians: 'EPH',
	php: 'PHP', phi: 'PHP', phil: 'PHP', philip: 'PHP', philippians: 'PHP',
	col: 'COL', colossians: 'COL',
	'1 th': '1TH', '1 thes': '1TH', '1 thess': '1TH', '1 thessalonians': '1TH', th1: '1TH',
	'2 th': '2TH', '2 thes': '2TH', '2 thess': '2TH', '2 thessalonians': '2TH', th2: '2TH',
	'1 ti': '1TI', '1 tim': '1TI', '1 timothy': '1TI', ti1: '1TI',
	'2 ti': '2TI', '2 tim': '2TI', '2 timothy': '2TI', ti2: '2TI',
	tit: 'TIT', titus: 'TIT',
	phm: 'PHM', phlm: 'PHM', plm: 'PHM', philem: 'PHM', philemon: 'PHM',
	heb: 'HEB', hebrews: 'HEB',
	jas: 'JAS', jam: 'JAS', james: 'JAS',
	'1 pe': '1PE', '1 pet': '1PE', '1 pt': '1PE', '1 peter': '1PE', pe1: '1PE',
	'2 pe': '2PE', '2 pet': '2PE', '2 pt': '2PE', '2 peter': '2PE', pe2: '2PE',
	'1 jn': '1JN', '1 joh': '1JN', '1 john': '1JN', jo1: '1JN',
	'2 jn': '2JN', '2 joh': '2JN', '2 john': '2JN', jo2: '2JN',
	'3 jn': '3JN', '3 joh': '3JN', '3 john': '3JN', jo3: '3JN',
	jude: 'JUD', jde: 'JUD',
	rev: 'REV', revelation: 'REV',
};

/** Alias with all whitespace removed, which is how the table is keyed. */
function aliasKey(alias: string): string {
	return alias.toLowerCase().replace(/\s+/g, '');
}

/**
 * Whitespace-free lookup.
 *
 * The table above writes numbered books with a space (`1 sam`) because that is
 * how a person reads them, but the pattern below makes that space optional —
 * these commentaries write both `1 Sam 3:1` and `1Sa. 12:3`. Keying on the
 * space-free form is what lets one entry serve both spellings. Getting this
 * wrong is silent: the reference still matches the pattern, the table lookup
 * misses, and the citation renders as plain text with no error anywhere.
 */
const ALIAS_LOOKUP: ReadonlyMap<string, string> = new Map(
	Object.entries(BOOK_ALIASES).map(([alias, usfm]) => [aliasKey(alias), usfm]),
);

/**
 * Longest alias first, so `1 corinthians` wins over `1 co` and `psalms` over
 * `psa`. Regex alternation is first-match-wins, so this ordering is load-bearing
 * rather than cosmetic.
 */
const ALIAS_PATTERN = Object.keys(BOOK_ALIASES)
	.sort((a, b) => b.length - a.length)
	.map((alias) => alias.replace(/ /g, '\\s*'))
	.join('|');

/**
 * Books that have exactly one chapter.
 *
 * These are cited as `Jude 3` or `Phlm 12`, where the bare number is a *verse*,
 * not a chapter. Reading it as a chapter sends the reader to a page that does
 * not exist, so the distinction has to be encoded rather than inferred.
 */
const SINGLE_CHAPTER_BOOKS = new Set(['OBA', 'PHM', '2JN', '3JN', 'JUD']);

/**
 * `Rom 8:1-39`, `Pe1 2:25`, `1 Cor 13`, `Ps 23`, `Pss 23-28`.
 *
 * A reference carries either a verse (`8:1-39`) or a chapter range (`23-28`),
 * never both, so those two tails are alternatives. Matching the range rather
 * than stopping at `23` keeps the link text whole instead of leaving a stray
 * `-28` sitting outside the anchor.
 *
 * The trailing guard stops the three-digit cap from biting off the front of a
 * longer number, so `Gen 1234` is left alone rather than linked as Genesis 123.
 */
const REFERENCE = new RegExp(
	`\\b(${ALIAS_PATTERN})\\.?\\s{0,2}(\\d{1,3})(?::(\\d{1,3})(?:\\s?[-–—]\\s?\\d{1,3})?|\\s?[-–—]\\s?\\d{1,3})?(?![\\d:])`,
	'gi',
);

export function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/**
 * Where a reference points.
 *
 * A verse goes to the version-agnostic verse hub, which shows it in ten
 * translations. A chapter-only reference goes to that chapter's study page,
 * which is version-agnostic too. Neither destination carries a translation in
 * its URL, so a cross-reference never silently moves the reader to a different
 * Bible than the one they were reading.
 */
function referenceHref(
	usfm: string,
	chapter: string,
	verse: string | undefined,
): string {
	const slug = bookSlugFromUsfm(usfm);
	// In a one-chapter book the single number is the verse, so `Jude 3` is
	// Jude 1:3 and belongs on the verse hub, not on a chapter page.
	if (verse === undefined && SINGLE_CHAPTER_BOOKS.has(usfm)) {
		return `/verse/${slug}/1/${chapter}`;
	}
	return verse
		? `/verse/${slug}/${chapter}/${verse}`
		: `/${slug}/${chapter}`;
}

/**
 * Link the scripture references in already-escaped text.
 *
 * Escaping first and linking second is deliberate: the anchors this inserts must
 * not themselves be escaped, and running the passes the other way round would
 * mangle every `href`. A single pass over the escaped string cannot nest, so no
 * anchor ends up inside another.
 */
export function linkScriptureRefs(escaped: string): string {
	return escaped.replace(
		REFERENCE,
		(match, alias: string, chapter: string, verse?: string) => {
			// A book name is always capitalised in these texts, and requiring that
			// is what keeps ordinary English out of the linker: "he lost his job 1
			// day ago" and "the temperature is 40" would otherwise both become
			// scripture references.
			const initial = alias.match(/[A-Za-z]/)?.[0];
			if (!initial || initial !== initial.toUpperCase()) {
				return match;
			}
			const usfm = ALIAS_LOOKUP.get(aliasKey(alias));
			if (!usfm || Number(chapter) < 1) {
				return match;
			}
			if (verse !== undefined && Number(verse) < 1) {
				return match;
			}
			const href = referenceHref(usfm, chapter, verse);
			return `<a class="xref" href="${href}">${match}</a>`;
		},
	);
}

/**
 * One commentary note's raw strings, rendered as paragraphs of safe HTML.
 *
 * The upstream keeps structure in newlines rather than markup: Henry separates
 * his numbered points with a single `\n`, Jamieson-Fausset-Brown separates each
 * quoted phrase with a blank line. Splitting on any run of newlines recovers
 * both shapes without needing to know which source produced the string.
 *
 * The `--` substitution is typographic only. The 1871 text uses a double hyphen
 * where a printer would have set an em dash, and rendering it literally on the
 * web looks like a typo rather than punctuation. No word is altered.
 */
export function commentaryParagraphs(raw: readonly string[]): string[] {
	return raw
		.flatMap((block) => block.split(/\n+/))
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => linkScriptureRefs(escapeHtml(line)).replace(/--/g, '—'));
}

/**
 * Plain text for meta descriptions and JSON-LD, where markup would leak into a
 * search result. Collapses whitespace and drops the citation clutter that reads
 * badly out of context.
 */
export function commentaryPlainText(raw: readonly string[]): string {
	return raw
		.join(' ')
		.replace(/\s+/g, ' ')
		.replace(/--/g, '—')
		.trim();
}
