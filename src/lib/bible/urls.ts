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

export function absoluteUrl(site: URL | undefined, path: string): string {
	const base = site ?? new URL('https://biblehearth.com');
	return new URL(path, base).href;
}

export function truncate(text: string, max = 155): string {
	const collapsed = text.replace(/\s+/g, ' ').trim();
	if (collapsed.length <= max) {
		return collapsed;
	}
	return `${collapsed.slice(0, max - 1).trimEnd()}…`;
}
