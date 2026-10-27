import { SITE_ORIGIN } from '../../../site.config.mjs';
import { bookSlug } from './books';
import { displayChapterNumber } from './psalms';
import { bookSlugFromUsfm } from './usfm';
import { DEFAULT_LOCALE, localePath, type Locale } from '../i18n/locales';

/**
 * Reader URLs, in one locale.
 *
 * The locale is the last argument and defaults to English throughout, so every
 * existing English call site reads exactly as it did. Three things change when
 * one is passed: the `/pt` prefix, the book segment (`salmos`, not `psalms`) and
 * — for the Psalms in Russian and Romanian — the chapter number. Getting two of
 * the three right produces a URL that looks plausible and 404s, which is why
 * they are all derived here rather than assembled at call sites.
 */
export function versionPath(versionSlug: string, locale: Locale = DEFAULT_LOCALE): string {
	return localePath(locale, `/bible/${versionSlug}`);
}

export function bookPath(
	versionSlug: string,
	bookUsfm: string,
	locale: Locale = DEFAULT_LOCALE,
): string {
	return localePath(locale, `/bible/${versionSlug}/${bookSlug(locale, bookUsfm)}`);
}

export function chapterPath(
	versionSlug: string,
	bookUsfm: string,
	chapterId: string | number,
	locale: Locale = DEFAULT_LOCALE,
): string {
	const number = displayChapterNumber(locale, bookUsfm, chapterId);
	return `${bookPath(versionSlug, bookUsfm, locale)}/${number}`;
}

export function versePath(
	versionSlug: string,
	bookUsfm: string,
	chapterId: string | number,
	verseId: string | number,
	locale: Locale = DEFAULT_LOCALE,
): string {
	return `${chapterPath(versionSlug, bookUsfm, chapterId, locale)}/${verseId}`;
}

/**
 * The version-agnostic verse hub for a citation: `PHP.4.6-7` → `/verse/philippians/4/6`.
 *
 * A range resolves to its first verse, because that is the hub a reader who
 * followed the citation wants to land on and there is no hub for a span. Null
 * for a chapter-only reference, which has no verse hub at all — callers send
 * those to the study page instead.
 *
 * English-only, deliberately and for now. The verse hubs are ~31,000 URLs, so
 * localising them is the largest single expansion available here and it should
 * follow the chapter pages rather than lead them: a chapter is what people
 * search in these languages ("salmo 91"), and a hub with no brief above it is a
 * page with nothing of ours on it. Citations from a translated page therefore
 * point at the English hub, which is a real page in a second language rather
 * than a 404 in the reader's own.
 */
export function verseHubPath(usfm: string): string | null {
	const [book, chapter, verse] = usfm.split('.');
	const first = verse?.split('-')[0];
	if (!book || !chapter || !first) {
		return null;
	}
	return `/verse/${bookSlugFromUsfm(book)}/${chapter}/${first}`;
}

const FALLBACK_ORIGIN = SITE_ORIGIN;

export function siteOrigin(site?: URL): string {
	return (site ?? new URL(FALLBACK_ORIGIN)).origin;
}

export function normalizePath(path: string): string {
	const url = /^https?:\/\//i.test(path) ? new URL(path) : new URL(path, FALLBACK_ORIGIN);
	let pathname = url.pathname;
	if (pathname.length > 1 && pathname.endsWith('/')) {
		pathname = pathname.slice(0, -1);
	}
	return pathname || '/';
}

export function absoluteUrl(site: URL | undefined, path: string): string {
	const origin = siteOrigin(site);
	const pathname = normalizePath(path);
	if (pathname === '/') {
		return `${origin}/`;
	}
	return `${origin}${encodedPath(pathname)}`;
}

/**
 * Make a media URL absolute without dropping its query string.
 *
 * `absoluteUrl` is for page paths: it strips `?query` because a canonical
 * must not carry one. A framework image endpoint is the opposite — `/_image?href=…`
 * in development, `/_vercel/image?url=…` in production — and dropping the
 * query yields a 400. Social scrapers and JSON-LD both need the whole address.
 */
export function absoluteMediaUrl(site: URL | undefined, path: string): string {
	if (/^https?:\/\//i.test(path)) {
		return path;
	}
	return new URL(path, `${siteOrigin(site)}/`).href;
}

/**
 * A path percent-encoded for anywhere it leaves this process as bytes.
 *
 * Half the locales spell their book slugs in their own script — `/ko/시편/91`,
 * `/ar/مزمور/91`, `/ru/псалом/90` — and raw Unicode is fine in an `href` but not
 * in an HTTP header or an XML sitemap. A `Location` header is a ByteString, so
 * An unencoded redirect throws outright: "character at index 4 has a
 * value of 1087 which is greater than 255". Sitemaps are the quieter half of the
 * same problem — RFC 3986 wants the URL escaped and a raw one is invalid XML's
 * cousin: accepted by parsers, flagged by validators.
 *
 * Built with `URL` rather than `encodeURIComponent` per segment because it is
 * idempotent: a path that already carries `%D0%BF` is left exactly as it is,
 * where re-encoding would turn it into `%25D0%25BF` and 404. That matters
 * because incoming request paths arrive already encoded and some callers pass
 * them straight back.
 */
export function encodedPath(path: string): string {
	return new URL(path, FALLBACK_ORIGIN).pathname;
}

export function truncate(text: string, max = 155): string {
	const collapsed = text.replace(/\s+/g, ' ').trim();
	if (collapsed.length <= max) {
		return collapsed;
	}
	return `${collapsed.slice(0, max - 1).trimEnd()}…`;
}
