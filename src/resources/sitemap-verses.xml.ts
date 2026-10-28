import type { ResourceHandler } from '../lib/page/types';
import { urlsetXmlWithLastmod, xmlResponse } from '../lib/sitemap';
import { verseHubSeedPaths } from '../lib/seed';
import { verseHubPath } from '../lib/bible/urls';
import { listVerseBriefs } from '../lib/verse-briefs';

export const GET: ResourceHandler = async ({ request, site }) => {
	// Original explanations survive an upstream/seed failure and carry real dates.
	const briefs = await listVerseBriefs();
	const authored = briefs.flatMap(({ data }) => {
		const path = verseHubPath(data.usfm);
		return path ? [{ path, lastmod: data.reviewedAt }] : [];
	});
	const seeds = await verseHubSeedPaths().catch(() => []);
	return xmlResponse(
		urlsetXmlWithLastmod(site, [...authored, ...seeds.map((path) => ({ path }))]),
		request,
	);
};
