import type { ResourceHandler } from '../lib/page/types';
import { usfmFromLocaleBookSlug } from '../lib/bible/books';
import { chapterInRange, isCanonicalBook } from '../lib/bible/chapters';
import { hebrewChapter } from '../lib/bible/psalms';
import { isNumericChapter, isNumericVerse } from '../lib/bible/usfm';
import { bookPath, chapterPath, versePath, versionPath, encodedPath } from '../lib/bible/urls';
import { localePath } from '../lib/i18n/locales';

/** Keep navigation on the current origin, including local previews. */
function readerRedirect(target: URL, status: number): Response {
	return new Response(null, {
		status,
		headers: { Location: `${encodedPath(target.pathname)}${target.search}${target.hash}` },
	});
}

/** A query value that can safely become exactly one URL path segment. */
function isSafeRouteSegment(value: string): boolean {
	return (
		value.length > 0 &&
		value.length <= 128 &&
		!/[\\/?#\0]/u.test(value) &&
		value !== '.' &&
		value !== '..'
	);
}

export const GET: ResourceHandler = ({ url, locals }) => {
	const locale = locals.locale;
	const version = url.searchParams.get('version') ?? '';
	const bookSlug = url.searchParams.get('book') ?? '';
	const chapter = url.searchParams.get('chapter') ?? '';
	const verse = url.searchParams.get('verse') ?? '';

	// Version abbreviations are not ASCII-only: Russian's default is `нрп`.
	if (!isSafeRouteSegment(version)) {
		return readerRedirect(
			new URL(locale.prefix ? localePath(locale, '/') : '/versions', url.origin),
			302,
		);
	}

	if (!bookSlug) {
		return readerRedirect(new URL(versionPath(version, locale), url.origin), 302);
	}

	if (!isSafeRouteSegment(bookSlug)) {
		return new Response('Invalid book', { status: 400 });
	}

	const bookUsfm = usfmFromLocaleBookSlug(locale, bookSlug);
	if (!bookUsfm) {
		return new Response('Unknown book', { status: 404 });
	}

	if (!chapter) {
		return readerRedirect(new URL(bookPath(version, bookUsfm, locale), url.origin), 302);
	}

	if (!isNumericChapter(chapter)) {
		return new Response('Invalid chapter', { status: 400 });
	}

	const normalizedChapter = hebrewChapter(locale, bookUsfm, chapter);
	if (normalizedChapter === null) {
		return new Response('Unknown chapter', { status: 404 });
	}

	// The toolbar keeps the chapter list of the book being read, so changing the
	// book can carry a number the new one does not have — Psalm 119 into Ruth. The
	// reader's answer to that is the book's own page, not a 404.
	if (isCanonicalBook(bookUsfm) && !chapterInRange(bookUsfm, normalizedChapter)) {
		return readerRedirect(new URL(bookPath(version, bookUsfm, locale), url.origin), 302);
	}

	if (verse) {
		if (!isNumericVerse(verse)) {
			return new Response('Invalid verse', { status: 400 });
		}
		return readerRedirect(
			new URL(versePath(version, bookUsfm, normalizedChapter, verse, locale), url.origin),
			302,
		);
	}

	return readerRedirect(
		new URL(chapterPath(version, bookUsfm, normalizedChapter, locale), url.origin),
		302,
	);
};
