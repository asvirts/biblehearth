import { defineMiddleware } from 'astro:middleware';

/**
 * Freshness validators for HTML responses.
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
	const response = await next();

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
