import type { APIRoute } from 'astro';
import { listAnswers } from '../lib/answers';
import { briefedChapters } from '../lib/commentary';
import { LOCALES } from '../lib/i18n/locales';
import {
	latestDate,
	localeSitemapPath,
	sitemapIndexXml,
	STUDY_SITEMAP_PATH,
	xmlResponse,
	type SitemapEntry,
} from '../lib/sitemap';
import { listTopics } from '../lib/topics';

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
 */
async function childLastmods(): Promise<Record<string, Date | undefined>> {
	const [topics, answers, briefsPerLocale] = await Promise.all([
		listTopics(),
		listAnswers(),
		Promise.all(LOCALES.map((locale) => briefedChapters(locale))),
	]);

	const briefs = latestDate(
		briefsPerLocale.flat().map((chapter) => chapter.reviewedAt),
	);

	return {
		'/sitemap-pages.xml': briefs,
		'/sitemap-topics.xml': latestDate(
			topics.map((topic) => topic.data.reviewedAt),
		),
		'/sitemap-answers.xml': latestDate(
			answers.map((answer) => answer.data.reviewedAt),
		),
		[STUDY_SITEMAP_PATH]: briefs,
	};
}

export const GET: APIRoute = async ({ site, request }) => {
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
		{ path: STUDY_SITEMAP_PATH },
		// Curated seed set only — see lib/seed.ts for why. No date: a verse hub
		// is licensed Scripture, which does not have a review date, and the seed
		// set's own changes are not something anything at runtime can observe.
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
