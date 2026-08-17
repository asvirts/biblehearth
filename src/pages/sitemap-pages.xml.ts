import type { APIRoute } from 'astro';
import { pageSitemapPaths, urlsetXml, xmlResponse } from '../lib/sitemap';
import { listEnglishVersions, versionSlug } from '../lib/youversion/api';

export const GET: APIRoute = async ({ site }) => {
	try {
		const versions = await listEnglishVersions();
		const slugs = versions.map((version) => versionSlug(version, versions));
		return xmlResponse(urlsetXml(site, pageSitemapPaths(slugs)));
	} catch {
		return xmlResponse(urlsetXml(site, pageSitemapPaths([])));
	}
};
