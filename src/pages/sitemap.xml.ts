import type { APIRoute } from 'astro';
import { sitemapIndexXml, versionSitemapPath, xmlResponse } from '../lib/sitemap';
import { listEnglishVersions, versionSlug } from '../lib/youversion/api';

export const GET: APIRoute = async ({ site }) => {
	let versionSitemaps: string[] = [];

	try {
		const versions = await listEnglishVersions();
		versionSitemaps = versions.map((version) =>
			versionSitemapPath(versionSlug(version, versions)),
		);
	} catch {
		// Search Console reports any error status as "Sitemap could not be read"
		// and then backs off for days, so a throttled upstream must not take the
		// index down with it. The page sitemap needs no upstream call and always
		// resolves, so a degraded index still gets the site crawled; the version
		// sitemaps come back on the next read.
	}

	return xmlResponse(
		sitemapIndexXml(site, [
			// Neither of these touches the upstream, so they survive a throttle.
			'/sitemap-pages.xml',
			'/sitemap-topics.xml',
			// Curated seed set only — see lib/topics/seed.ts for why.
			'/sitemap-verses.xml',
			...versionSitemaps,
		]),
	);
};
