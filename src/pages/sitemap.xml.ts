import type { APIRoute } from 'astro';
import { listAnswers } from '../lib/answers';
import { briefedChapters } from '../lib/commentary';
import { LOCALES } from '../lib/i18n/locales';
import {
	latestDate,
	sitemapIndexXml,
	versionSitemapPath,
	xmlResponse,
	type SitemapEntry,
} from '../lib/sitemap';
import { listTopics } from '../lib/topics';
import {
	getDefaultVersion,
	listVersions,
	versionSlug,
} from '../lib/youversion/api';

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
		'/sitemap-commentary.xml': briefs,
	};
}

export const GET: APIRoute = async ({ site }) => {
	let versionSitemaps: string[] = [];

	try {
		const [versions, defaultVersion] = await Promise.all([
			listVersions(),
			getDefaultVersion(),
		]);

		/**
		 * The default translation only — not all nineteen.
		 *
		 * Every version renders the same chapters from the same upstream API, so
		 * submitting all of them multiplies one Bible's worth of crawlable pages
		 * by the size of the catalog: a five-figure crawl for a site that has not
		 * yet had its first translation indexed, spent on pages that differ from
		 * one another only in wording. It also means every crawler pass costs the
		 * app key nineteen passage fetches per chapter instead of one, which is
		 * how the rate limit got tripped in the first place.
		 *
		 * The other versions stay fully crawlable — they are linked from
		 * `/versions`, from the reader toolbar, and their own sitemap still
		 * resolves at `/sitemap-bible/<slug>.xml`. Add them back here once the
		 * default translation is actually indexed.
		 */
		if (defaultVersion) {
			versionSitemaps = [
				versionSitemapPath(versionSlug(defaultVersion, versions)),
			];
		}
	} catch {
		// Search Console reports any error status as "Sitemap could not be read"
		// and then backs off for days, so a throttled upstream must not take the
		// index down with it. The page sitemap needs no upstream call and always
		// resolves, so a degraded index still gets the site crawled; the version
		// sitemaps come back on the next read.
	}

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
		// Curated seed set only — see lib/seed.ts for why. No date: a verse hub
		// is licensed Scripture, which does not have a review date, and the seed
		// set's own changes are not something anything at runtime can observe.
		{ path: '/sitemap-verses.xml' },
		...versionSitemaps.map((path) => ({ path })),
	];

	return xmlResponse(
		sitemapIndexXml(
			site,
			children.map((child) => ({
				...child,
				lastmod: lastmods[child.path],
			})),
		),
	);
};
