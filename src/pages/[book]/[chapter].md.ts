import type { APIRoute } from 'astro';
import {
	isCanonicalLocaleBookSlug,
	usfmFromLocaleBookSlug,
} from '../../lib/bible/books';
import { hebrewChapter } from '../../lib/bible/psalms';
import { isNumericChapter } from '../../lib/bible/usfm';
import { chapterBriefIndex, chapterStudyPath } from '../../lib/commentary';
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
 *
 * Localised on exactly the same terms as the page: `/pt/salmos/91.md` is the
 * Portuguese brief and `/ru/псалом/90.md` is the Russian one. A twin is
 * per-locale rather than shared because its whole content is the original
 * writing — the one thing that differs by language — and because a twin that
 * served English text under a `/pt/` URL would be the clearest possible way to
 * tell a crawler the Portuguese page is a duplicate.
 */
/**
 * `/{book}/{chapter}.md`, read off the path rather than out of `params`.
 *
 * Astro repopulates route params after a middleware rewrite for `.astro` pages
 * but not for an endpoint whose route carries a static suffix: `/pt/salmo/91.md`
 * reaches this handler with `params` an empty object, while `/pt/salmo/91`
 * resolves normally. So this route takes its segments from `locals.localePath`,
 * which middleware has already stripped the locale prefix from and which is
 * identical to the pathname in English.
 *
 * One code path for every locale, and it does not depend on the quirk being
 * fixed or on it staying broken.
 */
const TWIN_PATH = /^\/([^/]+)\/([^/]+)\.md$/;

export const GET: APIRoute = async ({ locals, site, url }) => {
	const locale = locals.locale;
	const [, bookSlug, requestedChapter] =
		locals.localePath.match(TWIN_PATH) ?? [];
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
