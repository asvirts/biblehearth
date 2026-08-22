import type { APIRoute } from 'astro';
import { usfmFromLocaleBookSlug } from '../lib/bible/books';
import { hebrewChapter } from '../lib/bible/psalms';
import { isNumericChapter, isNumericVerse } from '../lib/bible/usfm';
import { bookPath, chapterPath, versePath, versionPath } from '../lib/bible/urls';
import { localePath } from '../lib/i18n/locales';

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

export const GET: APIRoute = ({ url, locals }) => {
	const locale = locals.locale;
	const version = url.searchParams.get('version') ?? '';
	const bookSlug = url.searchParams.get('book') ?? '';
	const chapter = url.searchParams.get('chapter') ?? '';
	const verse = url.searchParams.get('verse') ?? '';

	// Version abbreviations are not ASCII-only: Russian's default is `нрп`.
	if (!isSafeRouteSegment(version)) {
		return Response.redirect(
			new URL(
				locale.prefix ? localePath(locale, '/') : '/versions',
				url.origin,
			),
			302,
		);
	}

	if (!bookSlug) {
		return Response.redirect(new URL(versionPath(version, locale), url.origin), 302);
	}

	if (!isSafeRouteSegment(bookSlug)) {
		return new Response('Invalid book', { status: 400 });
	}

	const bookUsfm = usfmFromLocaleBookSlug(locale, bookSlug);
	if (!bookUsfm) {
		return new Response('Unknown book', { status: 404 });
	}

	if (!chapter) {
		return Response.redirect(
			new URL(bookPath(version, bookUsfm, locale), url.origin),
			302,
		);
	}

	if (!isNumericChapter(chapter)) {
		return new Response('Invalid chapter', { status: 400 });
	}

	const normalizedChapter = hebrewChapter(locale, bookUsfm, chapter);
	if (normalizedChapter === null) {
		return new Response('Unknown chapter', { status: 404 });
	}

	if (verse) {
		if (!isNumericVerse(verse)) {
			return new Response('Invalid verse', { status: 400 });
		}
		return Response.redirect(
			new URL(
				versePath(version, bookUsfm, normalizedChapter, verse, locale),
				url.origin,
			),
			302,
		);
	}

	return Response.redirect(
		new URL(chapterPath(version, bookUsfm, normalizedChapter, locale), url.origin),
		302,
	);
};
