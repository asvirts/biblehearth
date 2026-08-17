import type { APIRoute } from 'astro';
import { urlsetXml, xmlResponse } from '../lib/sitemap';
import { verseHubSeedPaths } from '../lib/topics/seed';

export const GET: APIRoute = async ({ site }) => {
	try {
		return xmlResponse(urlsetXml(site, await verseHubSeedPaths()));
	} catch {
		// An empty urlset beats an error status: Search Console treats any
		// failure as "could not be read" and backs off for days.
		return xmlResponse(urlsetXml(site, []));
	}
};
