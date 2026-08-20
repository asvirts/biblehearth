import { defineMiddleware } from 'astro:middleware';
import { DEFAULT_LOCALE, splitLocalePath } from './lib/i18n/locales';

/**
 * Locale resolution, then freshness validators for HTML responses.
 *
 * Two jobs in one middleware because Astro runs one chain and the order between
 * them is forced: the locale has to be decided before the page renders, and the
 * ETag has to be computed after it, because the rendered bytes differ by
 * language. Splitting them into two files would only hide that.
 *
 * Bing's guidelines ask for "HTTP validation headers such as ETags" alongside
 * sitemap `lastmod`, as the signals that let it tell a changed page from an
 * unchanged one without re-reading it. Nothing here was emitting either: every
 * response carried `Cache-Control` and nothing else, so every crawl of every
 * page was an unconditional full fetch.
 *
 * The ETag is computed from the rendered bytes rather than assembled from a
 * deploy id and a date. That costs a hash over the body, but it is the only
 * version that cannot drift from what was actually served — and a validator
 * that is wrong is worse than none, because a crawler acts on it.
 *
 * Pages that know their own editorial date set `Last-Modified` themselves (see
 * setLastModified); this handles the conditional request for both.
 */
export const onRequest = defineMiddleware(async (context, next) => {
	/**
	 * The locale is decided here and nowhere else.
	 *
	 * `[book]/[chapter]` is the greediest route in the app — 66 book slugs sit
	 * at the site root — so a three-segment `/es/salmo/91` would have to be
	 * matched by a route competing with it, and two-segment `/es/salmo` would
	 * resolve as the book `es`, chapter `salmo`. Stripping the prefix before
	 * routing avoids both: one set of route files serves all 58 locales, and the
	 * same `[book]/[chapter].astro` renders Psalm 91 in English and Salmo 91 in
	 * Spanish by reading `locals.locale`.
	 *
	 * `splitLocalePath` answers English for anything with no matching prefix, so
	 * `/api/warm` and `/sitemap.xml` fall through untouched without needing an
	 * exclusion list — no path segment they start with is a registered locale.
	 */
	const { locale, rest } = splitLocalePath(context.url.pathname);
	context.locals.locale = locale;
	context.locals.localePath = rest;

	/**
	 * Rewrite rather than redirect: `/es/salmo/91` is the canonical URL and must
	 * answer 200 at it. The prefix is removed only for route matching, so the
	 * address bar, the canonical tag and the sitemap all keep saying `/es/...`.
	 *
	 * The query string is carried across because `next()` takes a whole path and
	 * would otherwise drop it — which on this site would silently discard the
	 * `?day=` on a localized Verse of the Day.
	 *
	 * No `Vary: Accept-Language` anywhere in here, deliberately. The URL names
	 * the language, so there is nothing to negotiate, and varying on a header
	 * every browser sends differently would fragment the CDN cache for pages
	 * whose content does not depend on it.
	 */
	/**
	 * Rewritten as a whole `Request`, not as a path string.
	 *
	 * `next('/salmo/91')` looks equivalent and is not: it re-runs routing but
	 * leaves an endpoint's `params` empty, so `/pt/salmo/91.md` reached
	 * `[chapter].md.ts` with `params: {}` and 404'd while the `.astro` page on the
	 * same path resolved fine. Handing `next` a Request makes the rewrite a
	 * genuine re-dispatch, and params are recomputed for pages and endpoints
	 * alike.
	 */
	const response =
		locale.code === DEFAULT_LOCALE.code
			? await next()
			: await next(
					new Request(
						new URL(`${rest}${context.url.search}`, context.url),
						context.request,
					),
				);

	if (!isValidatable(context.request, response)) {
		return response;
	}

	// Buffering costs the streaming render, which this site was not getting much
	// from in any case: every page awaits its whole frontmatter — catalogue,
	// passage, commentary — before it emits a byte of body.
	const body = await response.arrayBuffer();
	const headers = new Headers(response.headers);
	headers.set('ETag', await weakEtag(body));

	if (isFresh(context.request, headers)) {
		return new Response(null, { status: 304, headers: validators(headers) });
	}

	return new Response(body, { status: response.status, headers });
});

/**
 * HTML 200s to a GET or HEAD, and nothing else.
 *
 * The sitemaps are excluded by the content-type check and need to be: they are
 * pre-gzipped `Uint8Array` bodies with their own `Content-Encoding`, so hashing
 * and re-wrapping them would be hashing the compressed form. Non-200s are
 * excluded because a 404 or a 503 is a state, not a representation — Bing is
 * meant to re-ask for those, and http.ts already answers them `no-store`.
 */
function isValidatable(request: Request, response: Response): boolean {
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return false;
	}
	if (response.status !== 200) {
		return false;
	}
	return (
		response.headers.get('Content-Type')?.includes('text/html') === true &&
		!response.headers.has('Content-Encoding')
	);
}

/**
 * Weak, not strong, and deliberately.
 *
 * A strong ETag is a promise about the exact octets, and we do not control
 * those all the way out: Vercel compresses on the way to the client, so the
 * bytes hashed here are not always the bytes delivered. Weak claims only that
 * the representation is semantically the same, which is exactly the question a
 * crawler is asking and the only one this hash can honestly answer.
 */
async function weakEtag(body: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-1', body);
	const hex = Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
	return `W/"${hex}"`;
}

function isFresh(request: Request, headers: Headers): boolean {
	const noneMatch = request.headers.get('If-None-Match');
	if (noneMatch) {
		// The tag is the stronger signal, so it settles the question on its own:
		// RFC 9110 says If-None-Match takes precedence and If-Modified-Since is
		// not to be consulted when it is present.
		return matchesEtag(noneMatch, headers.get('ETag'));
	}

	const since = request.headers.get('If-Modified-Since');
	const lastModified = headers.get('Last-Modified');
	if (!since || !lastModified) {
		return false;
	}

	const sinceMs = Date.parse(since);
	const modifiedMs = Date.parse(lastModified);
	if (Number.isNaN(sinceMs) || Number.isNaN(modifiedMs)) {
		return false;
	}
	// Both are HTTP dates and so already second-resolution; no flooring needed.
	return modifiedMs <= sinceMs;
}

/**
 * `*` matches anything we hold; otherwise compare tag by tag.
 *
 * The comparison ignores the `W/` prefix because that is what RFC 9110 calls
 * for on a conditional GET — every tag we issue is weak, so a strong-only
 * comparison would never match and the 304 would never fire.
 */
function matchesEtag(header: string, etag: string | null): boolean {
	if (!etag) {
		return false;
	}
	if (header.trim() === '*') {
		return true;
	}
	const bare = (tag: string) => tag.trim().replace(/^W\//, '');
	return header.split(',').some((tag) => bare(tag) === bare(etag));
}

/**
 * A 304 carries no body, so it re-sends only the headers that describe the
 * cached copy: the validators themselves, and the caching rules the client
 * should now apply to what it already has.
 */
function validators(headers: Headers): Headers {
	const kept = new Headers();
	for (const name of ['ETag', 'Last-Modified', 'Cache-Control', 'Vary']) {
		const value = headers.get(name);
		if (value) {
			kept.set(name, value);
		}
	}
	return kept;
}
