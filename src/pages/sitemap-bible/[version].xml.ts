import type { APIRoute } from 'astro';
import { isSafeSlug } from '../../lib/bible/usfm';
import { RETRY_AFTER_SECONDS } from '../../lib/http';
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
		// Retry-After so a throttled read is a postponement rather than the days
		// of backoff Search Console applies to an unexplained error.
		return new Response('Sitemap unavailable', {
			status: 503,
			headers: { 'Retry-After': String(RETRY_AFTER_SECONDS) },
		});
	}
};
