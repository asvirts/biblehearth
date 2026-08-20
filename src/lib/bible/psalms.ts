import type { Locale } from '../i18n/locales';

/**
 * The two ways the Psalms are numbered, and how to get between them.
 *
 * Every psalm from 10 to 147 has two numbers. The Septuagint merges Hebrew 9
 * and 10 into one psalm, so everything after it slides by one: the psalm a
 * Hebrew-numbered Bible calls 91 is 90 in the Greek, and in every tradition
 * that inherited its numbering — Orthodox Slavonic, Romanian Orthodox, the
 * Latin Vulgate. USFM numbers from the Hebrew, so `PSA.91` is this site's
 * spelling of it and `PSA.90` is a different psalm entirely.
 *
 * This is not a nicety. It is the difference between answering the query and
 * answering a query nobody asked:
 *
 * - «псалом 90» — 78K/month in Russian — is "Живый в помощи Вышнего", the
 *   protection psalm. That is `PSA.91`. Our `PSA.90` opens "Господи, Ты нам был
 *   приютом", which is about the brevity of human life and is not what anyone
 *   searching that phrase wants.
 * - „psalmul 50" — 40K/month in Romanian — is the Miserere. That is `PSA.51`.
 * - «псалом 26» — 25K/month in Ukrainian — is `PSA.27`.
 *
 * All three arrived from keyword research reading exactly one lower than the
 * chapter we would have served them, which is the tell: it is not three
 * coincidences, it is one numbering system.
 *
 * The offset is the easy half. The hard half is that the two systems also
 * disagree about how many psalms there are in four places, so a page has to be
 * able to say "this psalm is half of one of yours" rather than pretend the
 * mapping is a bijection. It is not.
 */

/** Which numbering a locale's readers type into a search box. */
export type PsalmNumbering = 'hebrew' | 'septuagint';

/**
 * Locales whose readers number the Psalms from the Septuagint.
 *
 * Keyed by what the *audience* uses, which is deliberately not the same
 * question as what the version we serve uses — and the two disagree for every
 * locale in this list. Russian readers know the Synodal Bible, which is
 * Septuagint-numbered; the Russian version on this app key is Biblica's, which
 * is Hebrew-numbered. So the mismatch is not a bug in one of them, it is a
 * standing fact about the locale, and the site has to hold both numbers at once
 * rather than pick a side.
 *
 * Conservative on purpose. A locale goes in here only where the dominant Bible
 * in the language is Septuagint-numbered and the search data shows readers
 * typing those numbers. Ethiopian Orthodox tradition has a claim to a place
 * here and Amharic is deliberately absent: its psalter numbering has its own
 * history, nobody on the team reads it, and guessing would silently misroute
 * every psalm in the language — the same failure this table exists to prevent,
 * pointed the other way.
 *
 * Ukrainian belongs here and is missing for a different reason: this app key is
 * not licensed for Ukrainian at all, so the locale does not exist yet. When it
 * does, it goes in.
 */
const SEPTUAGINT_LOCALES: ReadonlySet<string> = new Set([
	'ru',
	'ro',
	// Serbian Orthodox tradition, same inheritance as the two above.
	'sr',
]);

export function psalmNumbering(locale: Locale): PsalmNumbering {
	return SEPTUAGINT_LOCALES.has(locale.code) ? 'septuagint' : 'hebrew';
}

/**
 * Where the two systems stop agreeing, stated as the four places they differ.
 *
 * Written as the exceptions rather than as a 150-row table, because the
 * exceptions are the whole content: everything else is "add one" or "subtract
 * one", and a table would bury four interesting facts in 146 boring ones.
 *
 * Read each row as "these Hebrew psalms are these Septuagint psalms":
 *
 * - Hebrew 9 + 10 are one psalm in the Greek, LXX 9. This is the merge that
 *   creates the offset everything after it inherits.
 * - Hebrew 114 + 115 are LXX 113, a second merge.
 * - Hebrew 116 is split in the Greek into LXX 114 and 115, which puts the count
 *   back where the second merge left it.
 * - Hebrew 147 is split into LXX 146 and 147, which is what brings the last
 *   three psalms back into alignment.
 *
 * Both systems land on 150 psalms, having disagreed about the boundaries four
 * times on the way there.
 */
const DIVERGENCES: readonly {
	hebrew: readonly number[];
	septuagint: readonly number[];
}[] = [
	{ hebrew: [9, 10], septuagint: [9] },
	{ hebrew: [114, 115], septuagint: [113] },
	{ hebrew: [116], septuagint: [114, 115] },
	{ hebrew: [147], septuagint: [146, 147] },
];

/**
 * A Septuagint psalm number to the Hebrew chapter that carries its text.
 *
 * Returns the chapter to actually fetch — so `septuagintToHebrew(90)` is 91,
 * which is the number `PSA.n` wants. Where the Greek splits a Hebrew psalm in
 * two, both halves answer with the whole Hebrew chapter: LXX 114 and LXX 115
 * are each part of Hebrew 116, and serving the whole of 116 gives a reader
 * their half plus the other one, which is a longer answer rather than a wrong
 * one.
 *
 * Out-of-range numbers come back null rather than clamped. A URL asking for
 * psalm 0 or psalm 151 is asking for something that does not exist, and
 * quietly rounding it to 1 or 150 would serve a page under a number that is not
 * its own.
 */
export function septuagintToHebrew(psalm: number): number | null {
	if (!Number.isInteger(psalm) || psalm < 1 || psalm > 150) {
		return null;
	}

	for (const row of DIVERGENCES) {
		if (row.septuagint.includes(psalm)) {
			// The first Hebrew psalm in the row. For a merge that is the only
			// sensible answer; for a split both halves point at the same chapter.
			return row.hebrew[0]!;
		}
	}

	// 1-8 and 148-150 agree; everything between them is one higher in Hebrew.
	return psalm <= 8 || psalm >= 148 ? psalm : psalm + 1;
}

/**
 * A Hebrew psalm number to the Septuagint number a reader in this tradition
 * would recognise.
 *
 * The inverse of the above, and lossy in the same four places — Hebrew 9 and 10
 * are both LXX 9, and Hebrew 116 is both LXX 114 and 115. It returns the first
 * Septuagint number in the row, which is the one to lead with in a heading; use
 * `psalmNumberNote` when the page needs to be honest about the rest.
 */
export function hebrewToSeptuagint(psalm: number): number | null {
	if (!Number.isInteger(psalm) || psalm < 1 || psalm > 150) {
		return null;
	}

	for (const row of DIVERGENCES) {
		if (row.hebrew.includes(psalm)) {
			return row.septuagint[0]!;
		}
	}

	return psalm <= 8 || psalm >= 148 ? psalm : psalm - 1;
}

/**
 * The psalm number to put in a URL and a heading, for this locale.
 *
 * Hebrew-numbering locales get the number they already use, so this is the
 * identity for all but three of them and callers need no branch. Septuagint
 * locales get their own number — which is the point: `/ru/псалом/90` matches
 * what 78,000 people a month type, and `/ru/псалом/91` does not.
 */
export function localePsalmNumber(locale: Locale, hebrewPsalm: number): number {
	if (psalmNumbering(locale) === 'hebrew') {
		return hebrewPsalm;
	}
	return hebrewToSeptuagint(hebrewPsalm) ?? hebrewPsalm;
}

/**
 * A psalm number as it arrived in a URL, resolved to the chapter to fetch.
 *
 * The one function routing needs. A Hebrew-numbering locale passes the number
 * through; a Septuagint locale has its number translated. Null means the number
 * is not a psalm in this locale's system and the route should 404 rather than
 * serve its nearest neighbour.
 */
export function psalmChapterForLocale(
	locale: Locale,
	requested: number,
): number | null {
	if (psalmNumbering(locale) === 'hebrew') {
		return Number.isInteger(requested) && requested >= 1 && requested <= 150
			? requested
			: null;
	}
	return septuagintToHebrew(requested);
}

/**
 * The chapter number to show and to put in a URL, guarded by the book.
 *
 * The two functions below are the pair every route needs, and they are the only
 * place the conversion should ever happen. `displayChapterNumber` goes outward —
 * an internal Hebrew number to the number this locale writes. `hebrewChapter`
 * comes inward — a number that arrived in a URL to the chapter to actually
 * fetch. Everything between them counts in Hebrew, so a caller never has to
 * remember which of the two systems a variable is holding.
 *
 * Both pass non-Psalms straight through, so a caller can hand any book to them
 * without a branch. A chapter id that is not a number at all — a book intro —
 * also passes through `displayChapterNumber` untouched, which is what keeps it
 * safe to call from a book listing.
 */
export function displayChapterNumber(
	locale: Locale,
	bookUsfm: string,
	chapter: string | number,
): string | number {
	if (bookUsfm.toUpperCase() !== 'PSA') {
		return chapter;
	}
	const hebrew = Number(chapter);
	return Number.isInteger(hebrew) ? localePsalmNumber(locale, hebrew) : chapter;
}

/**
 * A chapter number as it arrived in a URL, resolved to the chapter to fetch.
 *
 * Null means the URL does not name a chapter this locale has, which is a 404
 * rather than a nearest-neighbour guess. Only the range is checked here; whether
 * the book actually goes that far is `chapterInRange`'s job, because that
 * depends on the book and this depends on the numbering.
 */
export function hebrewChapter(
	locale: Locale,
	bookUsfm: string,
	chapter: string | number,
): number | null {
	const requested = Number(chapter);
	if (!Number.isInteger(requested) || requested < 1) {
		return null;
	}
	if (bookUsfm.toUpperCase() !== 'PSA') {
		return requested;
	}
	return psalmChapterForLocale(locale, requested);
}

/**
 * How to say "and the other tradition calls this one something else", or null
 * when there is nothing to say.
 *
 * Returned as the two numbers rather than a sentence, because the sentence has
 * to be written in the locale's own language and this module has no business
 * holding Russian prose. Null for a psalm both traditions agree on — 1 to 8 and
 * 148 to 150 — so a page can omit the note entirely rather than print a
 * reassurance that the numbering is fine.
 *
 * `shared` marks the four psalms where the mapping is not one-to-one, and is
 * what lets a page say "part of" instead of claiming a false equivalence. A
 * reader who came for LXX 114 and got the whole of Hebrew 116 deserves to be
 * told why the page is longer than the psalm they asked for.
 */
export function psalmNumberNote(
	locale: Locale,
	hebrewPsalm: number,
): { hebrew: number; septuagint: number; shared: boolean } | null {
	if (psalmNumbering(locale) === 'hebrew') {
		return null;
	}
	const septuagint = hebrewToSeptuagint(hebrewPsalm);
	if (septuagint === null || septuagint === hebrewPsalm) {
		return null;
	}
	const shared = DIVERGENCES.some(
		(row) =>
			row.hebrew.includes(hebrewPsalm) &&
			(row.hebrew.length > 1 || row.septuagint.length > 1),
	);
	return { hebrew: hebrewPsalm, septuagint, shared };
}
