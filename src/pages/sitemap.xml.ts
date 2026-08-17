import type { APIRoute } from 'astro';
import { sitemapIndexXml, xmlResponse } from '../lib/sitemap';
import { listEnglishVersions, versionSlug } from '../lib/youversion/api';

export const GET: APIRoute = async ({ site }) => {
	try {
		const versions = await listEnglishVersions();
		const versionSitemaps = versions.map(
			(version) => `/sitemap-bible/${versionSlug(version, versions)}.xml`,
		);
		return xmlResponse(
			sitemapIndexXml(site, ['/sitemap-pages.xml', ...versionSitemaps]),
		);
	} catch {
		return xmlResponse(sitemapIndexXml(site, ['/sitemap-pages.xml']));
	}
};
