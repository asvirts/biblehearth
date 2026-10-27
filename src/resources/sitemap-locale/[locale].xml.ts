import type { ResourceHandler } from '../../lib/page/types';
import { versionPath } from '../../lib/bible/urls';
import { RETRY_AFTER_SECONDS } from '../../lib/http';
import { localeForCode } from '../../lib/i18n/locales';
import { bibleSitemapPaths, urlsetXml, xmlResponse } from '../../lib/sitemap';
import {
	getBibleIndex,
	getDefaultVersion,
	listVersions,
	versionSlug,
} from '../../lib/youversion/api';

/**
 * The default licensed Bible edition for one locale.
 *
 * The locale code is stable and unique where translation abbreviations are not:
 * Spanish, Portuguese and European Spanish can all have an `nvi`. Resolving the
 * edition inside the child sitemap keeps those colliding slugs isolated behind
 * their locale prefixes and lets the root index remain entirely upstream-free.
 */
export const GET: ResourceHandler = async ({ params, request, site }) => {
	const code = params.locale;
	const locale = code ? localeForCode(code) : null;
	if (!locale) {
		return new Response('Not found', { status: 404 });
	}

	try {
		const [version, catalog] = await Promise.all([getDefaultVersion(locale), listVersions(locale)]);
		if (!version) {
			throw new Error(`No default Bible version for locale ${locale.code}`);
		}

		const slug = versionSlug(version, catalog);
		const index = await getBibleIndex(version.id);
		return xmlResponse(
			urlsetXml(site, [versionPath(slug, locale), ...bibleSitemapPaths(slug, index, locale)]),
			request,
		);
	} catch {
		// A locale disappearing during an upstream throttle is temporary. Tell a
		// crawler when to retry rather than returning an empty sitemap and teaching
		// it that the language has no URLs.
		return new Response('Sitemap unavailable', {
			status: 503,
			headers: { 'Retry-After': String(RETRY_AFTER_SECONDS) },
		});
	}
};
