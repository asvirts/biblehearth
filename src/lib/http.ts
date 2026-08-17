/**
 * Scripture is immutable, so reader pages are cached hard at the edge.
 *
 * `stale-while-revalidate` keeps the CDN serving instantly past the TTL while
 * it refreshes in the background, and `stale-if-error` lets it keep serving a
 * known-good page when the upstream is throttled or down — which is what turns
 * a transient YouVersion 429 into a non-event instead of a site-wide outage.
 *
 * Vercel keys its cache by deployment, so every deploy is a full purge; long
 * TTLs cannot serve stale markup across a release.
 */
export const READER_CACHE_CONTROL =
	'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800';

/** Verse of the Day rotates daily, so the home page refreshes far sooner. */
export const HOME_CACHE_CONTROL =
	'public, max-age=300, s-maxage=900, stale-while-revalidate=86400, stale-if-error=86400';

export const SITEMAP_CACHE_CONTROL =
	'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800';

/**
 * 404 is a cacheable status on Vercel. Serving it `no-store` means every dead
 * link, stale scraper URL, and malformed crawl path re-invokes the function.
 */
export const NOTFOUND_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400';

/** Genuine upstream failures must never be cached. */
export const ERROR_CACHE_CONTROL = 'no-store';

export function setCacheControl(
	response: { headers: Headers },
	value: string,
): void {
	response.headers.set('Cache-Control', value);
}
