/**
 * Scripture is immutable, so reader pages are cached hard at the edge.
 *
 * `stale-while-revalidate` keeps the CDN serving instantly past the TTL while it
 * refreshes in the background.
 *
 * `stale-if-error` is declared for correctness and for any cache downstream of
 * us, but Vercel does not implement it — a throttled upstream will not be
 * papered over at the edge. Resilience to a failing upstream comes from the
 * application cache instead, which holds a usable value for a week past its
 * refresh point; see lib/cache/store.ts.
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
 * Markdown twins of the editorial pages: cached as hard as the sitemaps.
 *
 * These are assembled entirely from `src/content/*` and never touch the
 * licensed-scripture upstream, so unlike a reader page there is nothing here
 * that a throttle can take away and nothing that goes stale between deploys.
 * Vercel purges its cache on every deploy, which is also the only moment the
 * content collections can have changed.
 */
export const MARKDOWN_CACHE_CONTROL = SITEMAP_CACHE_CONTROL;

/**
 * 404 is a cacheable status on Vercel. Serving it `no-store` means every dead
 * link, stale scraper URL, and malformed crawl path re-invokes the function.
 */
export const NOTFOUND_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400';

/**
 * A page that rendered its own writing but not the Scripture beside it.
 *
 * Topic and answer pages are mostly ours: the short answer, the groups and their
 * rationales, the per-verse glosses, the FAQ, the prose from `src/content`. None
 * of that comes from upstream, so a throttled app key costs those pages the
 * verse text and nothing else — the argument still reads, and `StatusMessage`
 * says what is missing. Serving 503 for that threw away a complete article, and
 * taught Googlebot that the URLs carrying our only original writing are
 * unreliable. They return 200 instead, and 503 is reserved for a page with
 * nothing on it.
 *
 * The TTL is what keeps that honest. `READER_CACHE_CONTROL` would pin a
 * passage-less page at the edge for a day, so a five-minute throttle would
 * outlive itself by 24 hours; five minutes here means the page repairs itself
 * about as soon as the upstream does. Short, not `no-store`: the degraded page
 * is still worth serving, and a crawl that arrives during a throttle should not
 * re-invoke the function for every URL in the section.
 *
 * No `Retry-After`. The response is a 200 and there is nothing to retry.
 */
export const DEGRADED_CACHE_CONTROL =
	'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';

/**
 * Genuine upstream failures must never be cached.
 *
 * Not a real choice on Vercel in any case: only 200, 404, 410 and the redirect
 * statuses are cacheable, so a 503 re-invokes the function every time however it
 * is labelled. That is why the upstream cooldown lives in the application (see
 * lib/cache/breaker.ts) — the edge cannot absorb an error response for us.
 */
export const ERROR_CACHE_CONTROL = 'no-store';

/**
 * Matches the `retry-after` the upstream API returns on a 429.
 *
 * Since the CDN cannot cache a 503, asking crawlers to back off is the only
 * lever that reduces error traffic. Googlebot honours `Retry-After` on a 503
 * rather than retrying immediately, which is what gives the app key a quiet
 * window to recover in.
 */
export const RETRY_AFTER_SECONDS = 300;

export function setCacheControl(
	response: { headers: Headers },
	value: string,
): void {
	response.headers.set('Cache-Control', value);
}

/**
 * The editorial date of a page, as a validator a crawler can ask against.
 *
 * Bing's guidelines name `lastmod` and HTTP validators in the same breath as
 * the things that let it detect a change without re-reading the page. The
 * sitemap half of that is already honest — `<lastmod>` is emitted only where a
 * real review date exists (see lib/sitemap.ts) — and this is the same rule
 * applied to the response: only pages carrying a `reviewedAt` set it.
 *
 * Reader pages deliberately do not. Their content is scripture, which does not
 * change, wrapped in markup that changes only on deploy — and a `Last-Modified`
 * of "whenever we last shipped" is the fabricated freshness signal the sitemap
 * comment already refuses to emit. Those pages get an ETag from the middleware
 * instead, which is derived from the bytes and therefore cannot lie.
 */
export function setLastModified(
	response: { headers: Headers },
	date: Date,
): void {
	response.headers.set('Last-Modified', date.toUTCString());
}

/**
 * Cache and retry headers for a page that may have failed to load its data.
 *
 * `cacheControl` applies on success; anything else gets the error policy, plus
 * `Retry-After` when the status is one a crawler should come back from.
 */
export function setPageHeaders(
	response: { headers: Headers },
	status: number,
	cacheControl: string,
): void {
	setCacheControl(
		response,
		status === 200 ? cacheControl : ERROR_CACHE_CONTROL,
	);
	if (status === 503 || status === 429) {
		response.headers.set('Retry-After', String(RETRY_AFTER_SECONDS));
	}
}
