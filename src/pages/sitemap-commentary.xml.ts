import type { APIRoute } from 'astro';
import { absoluteUrl } from '../lib/bible/urls';
import { STUDY_SITEMAP_LEGACY_PATH, STUDY_SITEMAP_PATH } from '../lib/sitemap';

/**
 * Old name, kept as a 301.
 *
 * The studies used to live under `/commentary`, and this file was named for
 * that prefix. Search Console may still be fetching it from an earlier
 * submission. The URLs inside did not change — only the sitemap's own address
 * — so a permanent redirect is enough; listing both in the index would submit
 * the same loc twice.
 */
export const GET: APIRoute = ({ site }) =>
	Response.redirect(absoluteUrl(site, STUDY_SITEMAP_PATH), 301);
