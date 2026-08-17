import type { APIRoute } from 'astro';
import { urlsetXml, xmlResponse } from '../lib/sitemap';
import { versionPath } from '../lib/bible/urls';
import { listEnglishVersions, versionSlug } from '../lib/youversion/api';

export const GET: APIRoute = async ({ site }) => {
	const paths = ['/', '/versions'];

	try {
		const versions = await listEnglishVersions();
		for (const version of versions) {
			paths.push(versionPath(versionSlug(version, versions)));
		}
	} catch {
		// Page sitemap still lists the static hubs.
	}

	return xmlResponse(urlsetXml(site, paths));
};
