/**
 * Book slugs and book names, per locale.
 *
 * English keeps its own table in lib/bible/usfm.ts — 103 books including the
 * deuterocanon, hand-kept, and the one every existing URL on the site was built
 * from. Everything here is generated from publisher titles (see
 * scripts/generate-book-slugs.mjs) and covers only the books its version
 * carries, which for Indonesian is the New Testament and nothing else.
 *
 * Callers pass a locale and never branch on which one it is. English resolving
 * through its own table is an implementation detail of this module, not a
 * special case every page has to remember.
 */
import type { Locale } from '../../i18n/locales';
import {
	BOOK_META,
	bookNameForChapter as englishBookNameForChapter,
	bookNameFromUsfm as englishBookName,
	bookSlugFromUsfm as englishBookSlug,
	isKnownBookId,
	usfmFromBookSlug as englishUsfmFromSlug,
	type BookId,
} from '../usfm';
import { slugifyBookTitle } from './slug';
import { LOCALE_BOOK_TABLES } from './tables';
import type { LocalizedBook } from './types';

export type { LocalizedBook } from './types';
export { slugifyBookTitle } from './slug';

/**
 * Every locale's table, keyed by locale code.
 *
 * The 57 translated tables and their imports are generated together in
 * `tables.ts`, because an import quietly missing from a hand-written list of
 * fifty-seven is a locale that silently has no book names — the exact failure
 * English hit when it was left out of this map.
 *
 * English is added here rather than generated: it is hand-kept in
 * lib/bible/usfm.ts and covers 103 books including the deuterocanon, which no
 * generated table carries. The slug and name lookups below still delegate to
 * usfm.ts, so there is still exactly one English table.
 */
const TABLES: Readonly<Record<string, readonly LocalizedBook[]>> = {
	...LOCALE_BOOK_TABLES,
	en: BOOK_META,
};

type LocaleIndex = {
	books: readonly LocalizedBook[];
	byUsfm: Map<string, LocalizedBook>;
	bySlug: Map<string, LocalizedBook>;
};

const indexes = new Map<string, LocaleIndex>();

function indexFor(locale: Locale): LocaleIndex | null {
	const table = TABLES[locale.code];
	if (!table) {
		return null;
	}
	let cached = indexes.get(locale.code);
	if (!cached) {
		cached = {
			books: table,
			byUsfm: new Map(table.map((book) => [book.usfm, book])),
			bySlug: new Map(table.map((book) => [book.slug, book])),
		};
		indexes.set(locale.code, cached);
	}
	return cached;
}

/**
 * Every book this locale can actually render, in canonical order.
 *
 * Shorter than 66 for a locale whose only licensed version is a New Testament,
 * which is why the book list, the sitemap and the chapter grid all read this
 * rather than iterating the canon. A locale is not missing those books, it does
 * not have them, and offering a link to a chapter with no text behind it is
 * worse than not offering it.
 */
export function localizedBooks(locale: Locale): readonly LocalizedBook[] {
	return indexFor(locale)?.books ?? [];
}

export function bookSlug(locale: Locale, usfm: string): string {
	const index = indexFor(locale);
	if (!index) {
		return englishBookSlug(usfm);
	}
	return index.byUsfm.get(usfm.toUpperCase())?.slug ?? englishBookSlug(usfm);
}

export function bookName(locale: Locale, usfm: string): string {
	const index = indexFor(locale);
	if (!index) {
		return englishBookName(usfm);
	}
	return index.byUsfm.get(usfm.toUpperCase())?.name ?? englishBookName(usfm);
}

/**
 * Does this locale carry this book at all?
 *
 * The question a New Testament locale forces. Answered from the generated
 * table rather than from the canon, so it stays true when a locale's version
 * changes.
 */
export function hasBook(locale: Locale, usfm: string): boolean {
	const index = indexFor(locale);
	if (!index) {
		return isKnownBookId(usfm.toUpperCase());
	}
	return index.byUsfm.has(usfm.toUpperCase());
}

/**
 * A path segment back to a book id, or null.
 *
 * The incoming segment is slugified before it is matched, which is what makes
 * an Arabic or Korean URL survive being copied: `/ar/الأمثال/1` and
 * `/ar/الامثال/1` are the same book, and a Hangul path that arrived
 * NFD-decomposed still resolves. The raw USFM id is accepted too, on the same
 * terms English accepts it — as an alias to redirect, never as a page to serve.
 */
export function usfmFromLocaleBookSlug(
	locale: Locale,
	slug: string,
): BookId | null {
	const index = indexFor(locale);
	if (!index) {
		return englishUsfmFromSlug(slug) as BookId | null;
	}

	const decoded = safeDecode(slug);
	const exact =
		index.bySlug.get(decoded) ?? index.bySlug.get(slugifyBookTitle(decoded));
	if (exact) {
		return exact.usfm;
	}

	const upper = decoded.toUpperCase();
	return index.byUsfm.has(upper) ? (upper as BookId) : null;
}

/**
 * Is this the spelling this locale actually links with?
 *
 * Same contract as the English `isCanonicalBookSlug`: everything else is an
 * alias, and an alias is 301'd rather than served, so one page never exists at
 * two URLs. Non-Latin locales need this more than English does, not less —
 * every hamza variant and every normalisation form of a Korean title resolves,
 * which is exactly why only one of them may be canonical.
 */
export function isCanonicalLocaleBookSlug(
	locale: Locale,
	slug: string,
	usfm: string,
): boolean {
	return bookSlug(locale, usfm) === safeDecode(slug);
}

/**
 * The book name as it reads in front of a chapter number.
 *
 * "Psalms" is the book; one of them is a "Psalm" — and the same split exists in
 * French ("Psaumes" / "Psaume 91") and Portuguese ("Salmos" / "Salmo 91"). It
 * does not exist in the others: Spanish, German, Tagalog and Arabic publishers
 * already title the book in the form used in front of a number, and Korean uses
 * one word for both.
 *
 * Overrides live here, keyed by locale, and default to the publisher's title.
 * That default is the important half — inventing a singular for a language
 * nobody on the team reads would put a grammatical error in the h2 of every
 * chapter of its longest book, which is precisely how this bug shipped in
 * English.
 */
const CHAPTER_FORM: Partial<Record<string, Partial<Record<string, string>>>> = {
	// English is in the table for the same reason it is in TABLES: the moment it
	// stopped being the fall-through case, "Psalms 23" came back.
	en: { PSA: 'Psalm' },
	fr: { PSA: 'Psaume' },
	pt: { PSA: 'Salmo' },
};

export function localeBookNameForChapter(locale: Locale, usfm: string): string {
	const index = indexFor(locale);
	if (!index) {
		return englishBookNameForChapter(usfm);
	}
	const id = usfm.toUpperCase();
	return CHAPTER_FORM[locale.code]?.[id] ?? bookName(locale, id);
}

/** A percent-encoded segment, decoded — and left alone when it is not valid. */
function safeDecode(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}
