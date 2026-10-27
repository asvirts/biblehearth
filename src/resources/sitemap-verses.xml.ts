import type { ResourceHandler } from '../lib/page/types';
import { urlsetXml, xmlResponse } from '../lib/sitemap';
import { verseHubSeedPaths } from '../lib/seed';

export const GET: ResourceHandler = async ({ request, site }) => {
	try {
		return xmlResponse(urlsetXml(site, await verseHubSeedPaths()), request);
	} catch {
		// An empty urlset beats an error status: Search Console treats any
		// failure as "could not be read" and backs off for days.
		return xmlResponse(urlsetXml(site, []), request);
	}
};
