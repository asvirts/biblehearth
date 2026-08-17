import type { APIRoute } from 'astro';
import { sitemapIndexXml, versionSitemapPath, xmlResponse } from '../lib/sitemap';
import { listEnglishVersions, versionSlug } from '../lib/youversion/api';

export const GET: APIRoute = async ({ site }) => {
	try {
		const versions = await listEnglishVersions();
		const versionSitemaps = versions.map((version) =>
			versionSitemapPath(versionSlug(version, versions)),
		);
		return xmlResponse(
			sitemapIndexXml(site, ['/sitemap-pages.xml', ...versionSitemaps]),
		);
	} catch {
		return new Response('Sitemap unavailable', { status: 503 });
	}
};
