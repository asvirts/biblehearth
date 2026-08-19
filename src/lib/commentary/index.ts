import { getCollection, type CollectionEntry } from 'astro:content';
import { bookSlugFromUsfm } from '../bible/usfm';

export type ChapterBrief = CollectionEntry<'chapters'>;

export * from './api';
export * from './links';
export * from './sources';
export { commentaryParagraphs, commentaryPlainText, escapeHtml } from './text';

/**
 * The hub every study page hangs off.
 *
 * Books and chapters live at the site root — `/psalms`, `/psalms/28` — because
 * the page that carries the chapter, the summary and the commentary is the
 * answer to "Psalm 28", and a `/commentary/` prefix narrowed that promise to the
 * one part of the page a reader is least likely to have searched for. The hub
 * keeps a path of its own because the root is now spoken for by 66 book slugs.
 */
export const STUDY_HUB_PATH = '/study';

export function bookStudyPath(bookUsfm: string): string {
	return `/${bookSlugFromUsfm(bookUsfm)}`;
}

export function chapterStudyPath(
	bookUsfm: string,
	chapter: string | number,
): string {
	return `${bookStudyPath(bookUsfm)}/${chapter}`;
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
