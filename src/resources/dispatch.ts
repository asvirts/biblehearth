import type { ResourceHandler } from '../lib/page/types';
import { splitLocalePath } from '../lib/i18n/locales';
import { buildPageContext } from '../lib/page/context';
import { GET as sitemapIndex } from './sitemap.xml';
import { GET as sitemapAnswers } from './sitemap-answers.xml';
import { GET as sitemapCommentary } from './sitemap-commentary.xml';
import { GET as sitemapPages } from './sitemap-pages.xml';
import { GET as sitemapTopics } from './sitemap-topics.xml';
import { GET as sitemapVerses } from './sitemap-verses.xml';
import { GET as sitemapBible } from './sitemap-bible/[version].xml';
import { GET as sitemapLocale } from './sitemap-locale/[locale].xml';
import { GET as llms } from './llms.txt';
import { GET as chapterMarkdown } from './[book]/[chapter].md';
import { GET as topicMarkdown } from './topics/[slug].md';
import { GET as answerMarkdown } from './answers/[slug].md';
import { GET as read } from './read';
import { GET as warm } from './api/warm';
import { GET as i18nSmoke } from './api/i18n-smoke';

const fixed: Readonly<Record<string, ResourceHandler>> = {
	'/sitemap.xml': sitemapIndex,
	'/sitemap-answers.xml': sitemapAnswers,
	'/sitemap-commentary.xml': sitemapCommentary,
	'/sitemap-pages.xml': sitemapPages,
	'/sitemap-topics.xml': sitemapTopics,
	'/sitemap-verses.xml': sitemapVerses,
	'/llms.txt': llms,
	'/read': read,
	'/api/warm': warm,
	'/api/i18n-smoke': i18nSmoke,
};

type Match = { handler: ResourceHandler; params: Record<string, string> };

/** Resolve resource endpoints after removing a locale prefix, without decoding
 * encoded slashes into new route segments. The destination handlers validate
 * their own decoded parameters and enforce their own index/cache policy. */
function matchResource(pathname: string): Match | null {
	const { rest } = splitLocalePath(pathname);
	if (Object.hasOwn(fixed, rest)) return { handler: fixed[rest]!, params: {} };
	const patterns: ReadonlyArray<[RegExp, ResourceHandler, string]> = [
		[/^\/sitemap-bible\/([^/]+)\.xml$/, sitemapBible, 'version'],
		[/^\/sitemap-locale\/([^/]+)\.xml$/, sitemapLocale, 'locale'],
		[/^\/topics\/([^/]+)\.md$/, topicMarkdown, 'slug'],
		[/^\/answers\/([^/]+)\.md$/, answerMarkdown, 'slug'],
	];
	for (const [pattern, handler, key] of patterns) {
		const match = rest.match(pattern);
		if (match) {
			try {
				return { handler, params: { [key]: decodeURIComponent(match[1]!) } };
			} catch {
				// Match the endpoint even with malformed encoding; invalid values are
				// rejected by the handler instead of becoming an HTML chapter route.
				return { handler, params: { [key]: '' } };
			}
		}
	}
	if (/^\/[^/]+\/[^/]+\.md$/.test(rest)) {
		// This handler intentionally uses locals.localePath, which preserves the
		// original encoding for localized book-name lookup.
		return { handler: chapterMarkdown, params: {} };
	}
	return null;
}

export function isResourcePath(pathname: string): boolean {
	return matchResource(pathname) !== null;
}

/** Route a public URL to the framework-neutral handler that owns it. */
export async function dispatchResource(request: Request): Promise<Response> {
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
	}
	const url = new URL(request.url);
	const match = matchResource(url.pathname);
	if (!match) return new Response('Not found', { status: 404 });
	// The scheduled warmer intentionally changes shared cache state and spends
	// quota. A metadata-only HEAD must never trigger a warming run.
	if (request.method === 'HEAD' && match.handler === warm) {
		return new Response(null, { status: 405, headers: { Allow: 'GET' } });
	}
	const context = buildPageContext(request, match.params);
	const response = await match.handler(context);
	// HEAD has identical status and headers to GET without a message body.
	return request.method === 'HEAD'
		? new Response(null, {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			})
		: response;
}
