import type { APIRoute } from 'astro';
import { sitemapIndexXml, versionSitemapPath, xmlResponse } from '../lib/sitemap';
import {
	getDefaultVersion,
	listEnglishVersions,
	versionSlug,
} from '../lib/youversion/api';

export const GET: APIRoute = async ({ site }) => {
	let versionSitemaps: string[] = [];

	try {
		const [versions, defaultVersion] = await Promise.all([
			listEnglishVersions(),
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

	return xmlResponse(
		sitemapIndexXml(site, [
			// None of these touch the upstream, so they survive a throttle.
			'/sitemap-pages.xml',
			'/sitemap-topics.xml',
			'/sitemap-answers.xml',
			'/sitemap-commentary.xml',
			// Curated seed set only — see lib/seed.ts for why.
			'/sitemap-verses.xml',
			...versionSitemaps,
		]),
	);
};
