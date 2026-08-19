import type { APIRoute } from 'astro';
import { isNumericChapter, usfmFromBookSlug } from '../../lib/bible/usfm';
import { chapterBriefIndex } from '../../lib/commentary';
import {
	chapterBriefMarkdown,
	markdownNotFound,
	markdownResponse,
} from '../../lib/markdown';

/**
 * `/romans/8.md` — the study page's original writing, without the Scripture.
 *
 * Static `.md` beats the bare `[chapter]` segment in Astro's route ranking, the
 * same way `/sitemap-bible/[version].xml` does, so this never shadows the page
 * it mirrors.
 */
export const GET: APIRoute = async ({ params, site }) => {
	const bookSlug = params.book;
	const chapterId = params.chapter;
	if (!bookSlug || !chapterId || !isNumericChapter(chapterId)) {
		return markdownNotFound();
	}

	const bookUsfm = usfmFromBookSlug(bookSlug);
	if (!bookUsfm) {
		return markdownNotFound();
	}

	// No bounds check and no upstream call: a brief cannot exist for a chapter
	// that does not, so the lookup below is the only gate this route needs.
	const briefs = await chapterBriefIndex();
	const brief = briefs.get(`${bookUsfm}.${chapterId}`);
	if (!brief) {
		return markdownNotFound();
	}

	return markdownResponse(await chapterBriefMarkdown(brief, site));
};
