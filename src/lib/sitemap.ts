import type { BibleIndex } from '@youversion/platform-core';
import {
	bookSlugFromUsfm,
	isNumericChapter,
	usfmFromBookSlug,
} from './bible/usfm';
import {
	absoluteUrl,
	bookPath,
	chapterPath,
	normalizePath,
	versionPath,
} from './bible/urls';
import { SITEMAP_CACHE_CONTROL } from './http';

/** Sitemap protocol hard limit (uncompressed URL count). */
export const SITEMAP_URL_LIMIT = 50_000;

export function versionSitemapPath(versionSlug: string): string {
	return `/sitemap-bible/${versionSlug}.xml`;
}

export function pageSitemapPaths(versionSlugs: readonly string[]): string[] {
	const unique = [...new Set(versionSlugs)];
	return [
		'/',
		'/verse-of-the-day',
		'/versions',
		'/commentary',
		'/attributions',
		...unique.map(versionPath),
	];
}

/**
 * Books and chapters for one version — deliberately not its verses.
 *
 * Every verse page is a real, routable page and stays crawlable; the question
 * here is only what the site actively submits. A full Bible is roughly 31,000
 * verses, so a per-version verse listing asks Google to fetch more URLs for one
 * translation than the whole rest of the site combined, and each one is a single
 * verse of text that the chapter page already covers better.
 *
 * Verse-level coverage is submitted through `/sitemap-verses.xml` instead: the
 * version-agnostic `/verse/...` hubs, seeded from the curated set in lib/seed.ts.
 * One hub per verse, rather than one per verse per translation.
 *
 * Every crawled URL here is also an upstream passage fetch against a rate-limited
 * app key, which is what makes the distinction operational and not just tidy.
 */
export function bibleSitemapPaths(versionSlug: string, index: BibleIndex): string[] {
	const books: string[] = [];
	const chapters: string[] = [];

	for (const book of index.books) {
		if (!isRoutableBook(book.id)) {
			continue;
		}

		books.push(bookPath(versionSlug, book.id));

		for (const chapter of book.chapters) {
			if (!isNumericChapter(chapter.id)) {
				continue;
			}

			chapters.push(chapterPath(versionSlug, book.id, chapter.id));
		}
	}

	return [...books, ...chapters].slice(0, SITEMAP_URL_LIMIT);
}

export function urlsetXml(site: URL | undefined, paths: readonly string[]): string {
	const urls = uniquePaths(paths)
		.map((path) => `  <url>\n    <loc>${escapeXml(absoluteUrl(site, path))}</loc>\n  </url>`)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * Urlset carrying a real `<lastmod>`.
 *
 * Only used where the date is genuinely meaningful — topic pages have an
 * editorial review date. Emitting a fabricated or always-now `lastmod` is how
 * sites teach Google to ignore the field entirely, so reader pages deliberately
 * omit it. (BibleGateway's topical sitemap still advertises a 2014 lastmod,
 * which is the opposite failure.)
 */
export function urlsetXmlWithLastmod(
	site: URL | undefined,
	entries: readonly { path: string; lastmod?: Date }[],
): string {
	const seen = new Set<string>();
	const urls = entries
		.map((entry) => ({ ...entry, path: normalizePath(entry.path) }))
		.filter((entry) => {
			if (seen.has(entry.path)) {
				return false;
			}
			seen.add(entry.path);
			return true;
		})
		.map((entry) => {
			const loc = `    <loc>${escapeXml(absoluteUrl(site, entry.path))}</loc>`;
			const lastmod = entry.lastmod
				? `\n    <lastmod>${entry.lastmod.toISOString().slice(0, 10)}</lastmod>`
				: '';
			return `  <url>\n${loc}${lastmod}\n  </url>`;
		})
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function sitemapIndexXml(
	site: URL | undefined,
	paths: readonly string[],
): string {
	const items = uniquePaths(paths)
		.map(
			(path) =>
				`  <sitemap>\n    <loc>${escapeXml(absoluteUrl(site, path))}</loc>\n  </sitemap>`,
		)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

export async function xmlResponse(body: string): Promise<Response> {
	return new Response(await gzipUtf8(body), {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Content-Encoding': 'gzip',
			'Cache-Control': SITEMAP_CACHE_CONTROL,
			Vary: 'Accept-Encoding',
		},
	});
}

function isRoutableBook(bookId: string): boolean {
	return usfmFromBookSlug(bookSlugFromUsfm(bookId)) !== null;
}

function uniquePaths(paths: readonly string[]): string[] {
	return [...new Set(paths.map(normalizePath))];
}

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

async function gzipUtf8(body: string): Promise<Uint8Array> {
	const stream = new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}
