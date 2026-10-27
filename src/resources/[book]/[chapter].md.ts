import type { ResourceHandler } from '../../lib/page/types';
import { isCanonicalLocaleBookSlug, usfmFromLocaleBookSlug } from '../../lib/bible/books';
import { hebrewChapter } from '../../lib/bible/psalms';
import { isNumericChapter } from '../../lib/bible/usfm';
import { chapterBriefIndex, chapterStudyPath } from '../../lib/commentary';
import { chapterBriefMarkdown, markdownNotFound, markdownResponse } from '../../lib/markdown';

/**
 * `/romans/8.md` — the study page's original writing, without the Scripture.
 *
 * The resource dispatcher matches the `.md` suffix before page routing, so a
 * twin never shadows the chapter page it mirrors.
 *
 * Localised on exactly the same terms as the page: `/pt/salmos/91.md` is the
 * Portuguese brief and `/ru/псалом/90.md` is the Russian one. A twin is
 * per-locale rather than shared because its whole content is the original
 * writing — the one thing that differs by language — and because a twin that
 * served English text under a `/pt/` URL would be the clearest possible way to
 * tell a crawler the Portuguese page is a duplicate.
 */
/**
 * `/{book}/{chapter}.md`, read from the locale-stripped path. The path retains
 * its original percent encoding so localized book lookup can normalize it in
 * exactly the same way as the HTML chapter route.
 */
const TWIN_PATH = /^\/([^/]+)\/([^/]+)\.md$/;

export const GET: ResourceHandler = async ({ locals, site, url }) => {
	const locale = locals.locale;
	const [, bookSlug, requestedChapter] = locals.localePath.match(TWIN_PATH) ?? [];
	if (!bookSlug || !requestedChapter || !isNumericChapter(requestedChapter)) {
		return markdownNotFound();
	}

	const bookUsfm = usfmFromLocaleBookSlug(locale, bookSlug);
	if (!bookUsfm) {
		return markdownNotFound();
	}

	// Same conversion as the page, for the same reason: `/ru/псалом/90.md` is
	// `PSA.91`, and the brief index is keyed by the Hebrew number.
	const hebrew = hebrewChapter(locale, bookUsfm, requestedChapter);
	if (hebrew === null) {
		return markdownNotFound();
	}
	const chapterId = String(hebrew);

	// The twin inherits the page's alias problem, so it inherits the fix: see
	// isCanonicalLocaleBookSlug. `/psa/28.md` is a redirect, not a second copy.
	if (!isCanonicalLocaleBookSlug(locale, bookSlug, bookUsfm)) {
		const canonical = `${chapterStudyPath(bookUsfm, chapterId, locale)}.md`;
		return Response.redirect(new URL(canonical, site ?? url), 301);
	}

	// No bounds check and no upstream call: a brief cannot exist for a chapter
	// that does not, so the lookup below is the only gate this route needs. A
	// locale with no brief for this chapter 404s here, on the same terms that
	// make its page `noindex`.
	const briefs = await chapterBriefIndex(locale);
	const brief = briefs.get(`${bookUsfm}.${chapterId}`);
	if (!brief) {
		return markdownNotFound();
	}

	return markdownResponse(await chapterBriefMarkdown(brief, site, locale));
};
