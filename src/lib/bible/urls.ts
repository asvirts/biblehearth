import { bookSlugFromUsfm } from './usfm';

export function versionPath(versionSlug: string): string {
	return `/bible/${versionSlug}`;
}

export function bookPath(versionSlug: string, bookUsfm: string): string {
	return `/bible/${versionSlug}/${bookSlugFromUsfm(bookUsfm)}`;
}

export function chapterPath(
	versionSlug: string,
	bookUsfm: string,
	chapterId: string | number,
): string {
	return `${bookPath(versionSlug, bookUsfm)}/${chapterId}`;
}

export function versePath(
	versionSlug: string,
	bookUsfm: string,
	chapterId: string | number,
	verseId: string | number,
): string {
	return `${chapterPath(versionSlug, bookUsfm, chapterId)}/${verseId}`;
}

/**
 * The version-agnostic verse hub for a citation: `PHP.4.6-7` → `/verse/philippians/4/6`.
 *
 * A range resolves to its first verse, because that is the hub a reader who
 * followed the citation wants to land on and there is no hub for a span. Null
 * for a chapter-only reference, which has no verse hub at all — callers send
 * those to the study page instead.
 */
export function verseHubPath(usfm: string): string | null {
	const [book, chapter, verse] = usfm.split('.');
	const first = verse?.split('-')[0];
	if (!book || !chapter || !first) {
		return null;
	}
	return `/verse/${bookSlugFromUsfm(book)}/${chapter}/${first}`;
}

const FALLBACK_ORIGIN = 'https://biblehearth.online';

export function siteOrigin(site?: URL): string {
	return (site ?? new URL(FALLBACK_ORIGIN)).origin;
}

export function normalizePath(path: string): string {
	const url = /^https?:\/\//i.test(path)
		? new URL(path)
		: new URL(path, FALLBACK_ORIGIN);
	let pathname = url.pathname;
	if (pathname.length > 1 && pathname.endsWith('/')) {
		pathname = pathname.slice(0, -1);
	}
	return pathname || '/';
}

export function absoluteUrl(site: URL | undefined, path: string): string {
	const origin = siteOrigin(site);
	const pathname = normalizePath(path);
	return pathname === '/' ? `${origin}/` : `${origin}${pathname}`;
}

export function truncate(text: string, max = 155): string {
	const collapsed = text.replace(/\s+/g, ' ').trim();
	if (collapsed.length <= max) {
		return collapsed;
	}
	return `${collapsed.slice(0, max - 1).trimEnd()}…`;
}
