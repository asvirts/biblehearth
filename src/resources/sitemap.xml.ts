import type { ResourceHandler } from '../lib/page/types';
import { listAnswers } from '../lib/answers';
import { briefedChapters } from '../lib/commentary';
import { DEFAULT_LOCALE, LOCALES } from '../lib/i18n/locales';
import {
	latestDate,
	localeSitemapPath,
	sitemapIndexXml,
	xmlResponse,
	type SitemapEntry,
} from '../lib/sitemap';
import { listTopics } from '../lib/topics';
import { listVerseBriefs } from '../lib/verse-briefs';

/**
 * The newest review date behind each child sitemap.
 *
 * Read from the same collections the children list, so a date here cannot
 * describe a sitemap whose contents disagree with it. Nothing upstream is
 * touched: these are the already-loaded content collections, which is what
 * makes it affordable to compute on a route that must always answer.
 *
 * `pages` borrows the brief date because `/study` is the only URL in that
 * sitemap whose content moves — the rest are hand-written pages whose edits
 * live in git, where nothing at runtime can see them. A page sitemap that
 * claimed the deploy time instead would be reporting "everything changed"
 * on every deploy, which is the fabricated lastmod the whole file avoids.
 *
 * English briefs only, and that is the same rule `sitemap-pages.xml` applies to
 * `/study` itself: it is the English hub, so a Portuguese brief does not change
 * it. The commentary sitemap, which lists every locale's briefs, takes the newest
 * of all of them.
 */
async function childLastmods(): Promise<Record<string, Date | undefined>> {
	const [topics, answers, englishBriefs, briefsPerLocale, verses] = await Promise.all([
		listTopics(),
		listAnswers(),
		briefedChapters(DEFAULT_LOCALE),
		Promise.all(LOCALES.map((locale) => briefedChapters(locale))),
		listVerseBriefs(),
	]);

	const briefs = latestDate(briefsPerLocale.flat().map((chapter) => chapter.reviewedAt));

	return {
		'/sitemap-pages.xml': latestDate(englishBriefs.map((chapter) => chapter.reviewedAt)),
		'/sitemap-topics.xml': latestDate(topics.map((topic) => topic.data.reviewedAt)),
		'/sitemap-answers.xml': latestDate(answers.map((answer) => answer.data.reviewedAt)),
		'/sitemap-commentary.xml': briefs,
		'/sitemap-verses.xml': latestDate(verses.map(({ data }) => data.reviewedAt)),
	};
}

export const GET: ResourceHandler = async ({ request, site }) => {
	/**
	 * One default licensed Bible edition for every locale.
	 *
	 * The root index names stable locale sitemaps rather than looking up 58
	 * version slugs here. That keeps this route independent of the upstream API:
	 * a throttle can postpone one language's child sitemap, but it cannot erase
	 * every language from the index Google already knows.
	 *
	 * This does not submit the other editions a locale may carry. One edition per
	 * language is the bounded expansion the locale registry promises; adding all
	 * translations would multiply the same chapter inventory without adding a
	 * language.
	 */
	const localeSitemaps = LOCALES.map(localeSitemapPath);

	// A missing date costs a crawler one wasted re-read; a failed index costs
	// days of backoff. So this degrades to no dates rather than to no sitemap.
	let lastmods: Record<string, Date | undefined> = {};
	try {
		lastmods = await childLastmods();
	} catch {
		lastmods = {};
	}

	const children: SitemapEntry[] = [
		// None of these touch the upstream, so they survive a throttle.
		{ path: '/sitemap-pages.xml' },
		{ path: '/sitemap-topics.xml' },
		{ path: '/sitemap-answers.xml' },
		{ path: '/sitemap-commentary.xml' },
		// Curated seed set plus original explanations. Only authored explanations
		// have review dates; licensed Scripture is not dated as a content change.
		{ path: '/sitemap-verses.xml' },
		...localeSitemaps.map((path) => ({ path })),
	];

	return xmlResponse(
		sitemapIndexXml(
			site,
			children.map((child) => ({
				...child,
				lastmod: lastmods[child.path],
			})),
		),
		request,
	);
};
