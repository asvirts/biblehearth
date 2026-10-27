import { chapterStudyPath, bookStudyPath, STUDY_HUB_PATH } from './paths';
export { STUDY_HUB_PATH, bookStudyPath, chapterStudyPath, studyHubPath } from './paths';
import { getCollection, type CollectionEntry } from '../content';
import { DEFAULT_LOCALE, localeForCode, type Locale } from '../i18n/locales';

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
 *
 * `study` stays an English word in every locale's URL, which is deliberate and
 * temporary. Translating a route segment means choosing the noun a Thai or
 * Malayalam reader would search for, and guessing that for 57 languages would
 * put an invented word in 57 canonical URLs — the same failure the book slugs
 * are generated from publisher titles to avoid. The book and chapter segments,
 * which are the ones anyone actually searches, are already in the language.
 */

/**
 * The URL for one chapter, in one locale.
 *
 * `chapter` is always the Hebrew number — the one in `PSA.91`, the one every
 * other module counts in. What comes out is the number this locale's readers
 * use, which for the Psalms in Russian and Romanian is a different number: see
 * lib/bible/psalms.ts. Callers pass what they have and never convert, so there
 * is one place the two numbering systems meet instead of one per link.
 */

/**
 * The locale a brief is written in, from where its file sits.
 *
 * `src/content/chapters/pt/psalms-91.md` is Portuguese; `psalms-91.md` at the
 * top level is English. The locale lives in the path rather than in the
 * frontmatter because the glob loader already recurses, so this costs no schema
 * field and no loader change — and because a directory makes the one question
 * anyone asks of this collection ("which languages have Psalm 91?") answerable
 * by looking at it.
 *
 * A directory that is not a locale in the registry resolves to English rather
 * than throwing. That is the safe direction: a misfiled or as-yet-unregistered
 * folder shows up as an English brief competing with a real one, which is
 * visible in the sitemap, where the alternative is a build that dies on a file
 * somebody added on a branch.
 */
export function briefLocale(brief: ChapterBrief): Locale {
	const [first = '', ...rest] = brief.id.split('/');
	if (rest.length === 0) {
		return DEFAULT_LOCALE;
	}
	return localeForCode(first) ?? DEFAULT_LOCALE;
}

/**
 * Published briefs in one locale. Drafts are excluded from every surface.
 *
 * Scoped to a locale rather than returning everything, because every caller
 * wants one language: the study page renders one, the sitemap lists one
 * locale's URLs, llms.txt indexes one site. A caller that wants the whole set
 * asks per locale, which is also the shape hreflang needs.
 */
export async function listChapterBriefs(locale: Locale = DEFAULT_LOCALE): Promise<ChapterBrief[]> {
	const briefs = await getCollection('chapters', ({ data }) => !data.draft);
	return briefs
		.filter((brief) => briefLocale(brief).code === locale.code)
		.sort((a, b) => a.data.usfm.localeCompare(b.data.usfm));
}

/**
 * Chapter USFM → its brief, within one locale.
 *
 * Every surface that needs to know whether a chapter has original writing on it
 * asks this: the study page decides whether to index, the reader page decides
 * what to call its link, and the sitemap decides whether to list the URL at all.
 * One lookup, three decisions, no hand-kept list to fall out of date.
 *
 * Keyed by USFM and not by the locale's own chapter number, so a Russian brief
 * for `PSA.91` is found by the same key an English one is — the Septuagint
 * number belongs in URLs and headings, never in an index.
 */
export async function chapterBriefIndex(
	locale: Locale = DEFAULT_LOCALE,
): Promise<Map<string, ChapterBrief>> {
	const briefs = await listChapterBriefs(locale);
	return new Map(briefs.map((brief) => [brief.data.usfm, brief]));
}

/** Every chapter USFM that has a published brief, for sitemaps and link lists. */
export async function briefedChapters(
	locale: Locale = DEFAULT_LOCALE,
): Promise<{ usfm: string; title: string; reviewedAt: Date }[]> {
	const briefs = await listChapterBriefs(locale);
	return briefs.map((brief) => ({
		usfm: brief.data.usfm,
		title: brief.data.title,
		reviewedAt: brief.data.reviewedAt,
	}));
}

/**
 * Every locale that has a published brief for one chapter.
 *
 * This is what makes `hreflang` honest. A chapter is only indexable where
 * somebody wrote about it, so Psalm 91 briefed in English, Portuguese and
 * Spanish must advertise exactly those three — pointing at the other 55, where
 * the page renders `noindex`, would be a cluster of alternates that contradict
 * themselves, and a self-contradicting cluster is ignored wholesale rather than
 * partially honoured.
 *
 * Returns the empty array for a chapter nobody has written on, so the caller
 * emits no alternates at all rather than a cluster of one.
 */
export async function briefLocales(usfm: string): Promise<Locale[]> {
	const briefs = await getCollection('chapters', ({ data }) => !data.draft);
	const seen = new Map<string, Locale>();
	for (const brief of briefs) {
		if (brief.data.usfm !== usfm) {
			continue;
		}
		const locale = briefLocale(brief);
		seen.set(locale.code, locale);
	}
	return [...seen.values()];
}
