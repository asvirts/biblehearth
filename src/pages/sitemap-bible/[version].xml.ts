import type { APIRoute } from 'astro';
import { isSafeSlug } from '../../lib/bible/usfm';
import {
	bibleSitemapPaths,
	urlsetXml,
	versionSitemapPath,
	xmlResponse,
} from '../../lib/sitemap';
import { getBibleIndex, resolveVersion } from '../../lib/youversion/api';

export const GET: APIRoute = async ({ params, site, url }) => {
	const slug = params.version;
	if (!slug || !isSafeSlug(slug)) {
		return new Response('Not found', { status: 404 });
	}

	try {
		const resolved = await resolveVersion(slug);
		if (!resolved) {
			return new Response('Not found', { status: 404 });
		}

		if (resolved.slug !== slug) {
			return Response.redirect(
				new URL(versionSitemapPath(resolved.slug), site ?? url),
				301,
			);
		}

		const index = await getBibleIndex(resolved.version.id);
		return xmlResponse(urlsetXml(site, bibleSitemapPaths(resolved.slug, index)));
	} catch {
		return new Response('Sitemap unavailable', { status: 503 });
	}
};
