import { getCollection, type CollectionEntry } from 'astro:content';
import { bookSlugFromUsfm } from '../bible/usfm';

export type ChapterBrief = CollectionEntry<'chapters'>;

export * from './api';
export * from './links';
export * from './sources';
export { commentaryParagraphs, commentaryPlainText, escapeHtml } from './text';

export function commentaryBookPath(bookUsfm: string): string {
	return `/commentary/${bookSlugFromUsfm(bookUsfm)}`;
}

export function commentaryPath(
	bookUsfm: string,
	chapter: string | number,
): string {
	return `${commentaryBookPath(bookUsfm)}/${chapter}`;
}

/** Published briefs. Drafts are excluded from every surface. */
export async function listChapterBriefs(): Promise<ChapterBrief[]> {
	const briefs = await getCollection('chapters', ({ data }) => !data.draft);
	return briefs.sort((a, b) => a.data.usfm.localeCompare(b.data.usfm));
}

/**
 * Chapter USFM → its brief.
 *
 * Every surface that needs to know whether a chapter has original writing on it
 * asks this: the study page decides whether to index, the reader page decides
 * what to call its link, and the sitemap decides whether to list the URL at all.
 * One lookup, three decisions, no hand-kept list to fall out of date.
 */
export async function chapterBriefIndex(): Promise<Map<string, ChapterBrief>> {
	const briefs = await listChapterBriefs();
	return new Map(briefs.map((brief) => [brief.data.usfm, brief]));
}

/** Every chapter USFM that has a published brief, for sitemaps and link lists. */
export async function briefedChapters(): Promise<
	{ usfm: string; title: string; reviewedAt: Date }[]
> {
	const briefs = await listChapterBriefs();
	return briefs.map((brief) => ({
		usfm: brief.data.usfm,
		title: brief.data.title,
		reviewedAt: brief.data.reviewedAt,
	}));
}
