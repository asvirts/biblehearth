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
import { DEFAULT_LOCALE, type Locale } from './i18n/locales';
import { ABOUT_PATH, CONTACT_PATH, PRIVACY_PATH } from './site';

/** Sitemap protocol hard limit (uncompressed URL count). */
export const SITEMAP_URL_LIMIT = 50_000;

export function versionSitemapPath(versionSlug: string): string {
	return `/sitemap-bible/${versionSlug}.xml`;
}

/**
 * One stable child sitemap per locale.
 *
 * The path names the locale rather than its default version. Version slugs come
 * from the upstream catalogue and can collide across languages (`nvi` exists in
 * Spanish and Portuguese), while the locale code is already the site's unique
 * routing identity. It also lets the root sitemap list every language without
 * making 58 upstream calls merely to discover the current abbreviations.
 */
export function localeSitemapPath(
	locale: Pick<Locale, 'code'> | string,
): string {
	const code = typeof locale === 'string' ? locale : locale.code;
	return `/sitemap-locale/${code}.xml`;
}

export function pageSitemapPaths(versionSlugs: readonly string[]): string[] {
	const unique = [...new Set(versionSlugs)];
	return [
		'/',
		'/verse-of-the-day',
		'/versions',
		'/study',
		ABOUT_PATH,
		CONTACT_PATH,
		PRIVACY_PATH,
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
export function bibleSitemapPaths(
	versionSlug: string,
	// Structural rather than the API's own index type, so this module keeps
	// listing URLs without taking on what fetches them.
	index: {
		books: ReadonlyArray<{
			id: string;
			chapters: ReadonlyArray<{ id: string }>;
		}>;
	},
	locale: Locale = DEFAULT_LOCALE,
): string[] {
	const books: string[] = [];
	const chapters: string[] = [];

	for (const book of index.books) {
		if (!isRoutableBook(book.id)) {
			continue;
		}

		books.push(bookPath(versionSlug, book.id, locale));

		for (const chapter of book.chapters) {
			if (!isNumericChapter(chapter.id)) {
				continue;
			}

			chapters.push(chapterPath(versionSlug, book.id, chapter.id, locale));
		}
	}

	return [...books, ...chapters].slice(0, SITEMAP_URL_LIMIT);
}

/**
 * One entry in a sitemap or a sitemap index.
 *
 * `lastmod` is optional and stays optional on purpose — see
 * `urlsetXmlWithLastmod` for what a fabricated one costs.
 */
export type SitemapEntry = {
	path: string;
	lastmod?: Date;
};

export function urlsetXml(
	site: URL | undefined,
	paths: readonly string[],
): string {
	return urlsetXmlWithLastmod(
		site,
		paths.map((path) => ({ path })),
	);
}

/**
 * Urlset carrying a real `<lastmod>`.
 *
 * Only used where the date is genuinely meaningful — topic pages have an
 * editorial review date. Emitting a fabricated or always-now `lastmod` is how
 * sites teach Google to ignore the field entirely, so reader pages deliberately
 * omit it. (BibleGateway's topical sitemap still advertises a 2014 lastmod,
 * which is the opposite failure.)
 *
 * Which is why an entry without a date emits no tag rather than a placeholder,
 * and why a sitemap may honestly be a mix of both: a book study page changes
 * when somebody briefs one of its chapters, and carries that date, while the
 * sixty-five books nobody has written on yet carry none.
 */
export function urlsetXmlWithLastmod(
	site: URL | undefined,
	entries: readonly SitemapEntry[],
): string {
	const urls = uniqueEntries(entries)
		.map(
			(entry) =>
				`  <url>\n    <loc>${escapeXml(absoluteUrl(site, entry.path))}</loc>${lastmodTag(entry.lastmod)}\n  </url>`,
		)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * The index, whose `lastmod` is the one Google actually acts on.
 *
 * A child sitemap's date is the newest date inside it, which is what the
 * protocol means by the time the sitemap file was modified. It is also the
 * cheapest thing on the site: a crawler that trusts it can skip re-reading a
 * sitemap whose contents have not moved, and every URL it skips re-fetching
 * here is a licensed passage fetch not spent against a rate-limited app key.
 *
 * Children with nothing real to report — the verse hubs, the reader pages —
 * carry no date, on the same terms as the URLs inside them.
 */
export function sitemapIndexXml(
	site: URL | undefined,
	entries: readonly SitemapEntry[],
): string {
	const items = uniqueEntries(entries)
		.map(
			(entry) =>
				`  <sitemap>\n    <loc>${escapeXml(absoluteUrl(site, entry.path))}</loc>${lastmodTag(entry.lastmod)}\n  </sitemap>`,
		)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

/**
 * The newest of a set of dates, or nothing if the set is empty.
 *
 * `undefined` rather than the epoch or today, so a section with no dated
 * content omits its `lastmod` instead of claiming one.
 */
export function latestDate(
	dates: readonly (Date | undefined)[],
): Date | undefined {
	let latest: Date | undefined;
	for (const date of dates) {
		if (date && (!latest || date > latest)) {
			latest = date;
		}
	}
	return latest;
}

/**
 * A sitemap, gzipped only for a client that asked for gzip.
 *
 * `Content-Encoding: gzip` is a promise about the bytes, not a hint: a client
 * that did not offer gzip is entitled to read the body as-is, and one that
 * cannot inflate has no way to recover from a gzipped payload it never
 * requested. The sitemap protocol allows gzipped sitemaps and Googlebot does
 * send `Accept-Encoding: gzip`, so the common case is unchanged — but the
 * uncommon ones are exactly the ones that matter here. `curl` without `--compressed`,
 * a validator, or a hand-written fetch in a webmaster tool all got a file of
 * binary where XML was expected, which reads as a broken sitemap rather than as
 * a negotiation failure.
 *
 * `Vary: Accept-Encoding` is emitted either way, so a cache never serves one
 * variant to a client that needs the other.
 *
 * Pass the route's `request`. Omitting it serves the XML uncompressed, which is
 * the safe default: a caller that forgets loses some bandwidth, not correctness.
 */
export async function xmlResponse(
	body: string,
	request?: Request,
): Promise<Response> {
	const headers = new Headers({
		'Content-Type': 'application/xml; charset=utf-8',
		'Cache-Control': SITEMAP_CACHE_CONTROL,
		Vary: 'Accept-Encoding',
	});

	if (!acceptsGzip(request)) {
		return new Response(body, { headers });
	}

	headers.set('Content-Encoding', 'gzip');
	return new Response(await gzipUtf8(body), { headers });
}

/**
 * Whether `Accept-Encoding` permits gzip, per RFC 9110 §12.5.3.
 *
 * A missing header means no preference was stated, and the conservative reading
 * is identity — the protocol permits a server to assume gzip there, but nothing
 * on this site is worth a binary body sent to a client that never mentioned
 * compression.
 *
 * The `q=0` cases are the ones worth spelling out: `gzip;q=0` is an explicit
 * refusal, and `*;q=0` refuses everything not named, so a wildcard cannot be
 * read as blanket permission. `*` with a positive weight does permit gzip when
 * gzip itself is unmentioned.
 */
function acceptsGzip(request?: Request): boolean {
	const header = request?.headers.get('accept-encoding');
	if (!header) {
		return false;
	}

	const weights = new Map<string, number>();
	for (const part of header.split(',')) {
		const [token, ...params] = part.trim().split(';');
		const name = token?.trim().toLowerCase();
		if (!name) {
			continue;
		}
		const q = params
			.map((param) => param.trim().toLowerCase())
			.find((param) => param.startsWith('q='));
		const weight = q ? Number.parseFloat(q.slice(2)) : 1;
		weights.set(name, Number.isNaN(weight) ? 0 : weight);
	}

	const gzip = weights.get('gzip');
	if (gzip !== undefined) {
		return gzip > 0;
	}
	return (weights.get('*') ?? 0) > 0;
}

function isRoutableBook(bookId: string): boolean {
	return usfmFromBookSlug(bookSlugFromUsfm(bookId)) !== null;
}

/** Date-only, which is all a review date knows and all a crawler needs. */
function lastmodTag(lastmod?: Date): string {
	return lastmod
		? `\n    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>`
		: '';
}

/**
 * Entries by normalised path, first occurrence winning.
 *
 * First rather than newest-dated: a duplicate path in a sitemap is a bug in the
 * caller, and silently merging two disagreeing dates would hide it.
 */
function uniqueEntries(entries: readonly SitemapEntry[]): SitemapEntry[] {
	const seen = new Set<string>();
	const unique: SitemapEntry[] = [];
	for (const entry of entries) {
		const path = normalizePath(entry.path);
		if (seen.has(path)) {
			continue;
		}
		seen.add(path);
		unique.push({ ...entry, path });
	}
	return unique;
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
