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
