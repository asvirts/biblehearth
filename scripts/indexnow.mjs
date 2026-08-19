/**
 * Push changed URLs to IndexNow.
 *
 * The key file at the site root proves we own the domain. This is the other
 * half of the protocol: the call that says a URL changed. One submission is
 * shared between every participating engine — Bing, Yandex, Seznam, Naver — so
 * a URL sent here reaches all of them without a per-engine integration.
 *
 * IndexNow is for URLs that have *changed*. Resubmitting the whole site on a
 * schedule is how a domain earns a 429 and stops being trusted, and here it is
 * worse than merely wasteful: every crawled reader page is a licensed passage
 * fetch against a rate-limited app key, so a mass submission buys a mass crawl
 * of pages that did not change — the exact shape of the incident that
 * src/pages/api/warm.ts exists to prevent. Use --sitemap once, to seed a site
 * that has never been submitted, and pass explicit URLs from then on.
 *
 *   node scripts/indexnow.mjs /topics/anxiety /answers/what-is-grace
 *   node scripts/indexnow.mjs --sitemap --dry-run
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://api.indexnow.org/IndexNow';

/** Protocol ceiling for a single POST. */
const BATCH_LIMIT = 10_000;

/** The spec's key rule: 8-128 of [a-zA-Z0-9-], hosted as a bare .txt file. */
const KEY_FILE = /^([a-zA-Z0-9-]{8,128})\.txt$/;

/**
 * The documented responses. Worth spelling out rather than printing a bare
 * number, because three of them mean "your key is wrong" in three different
 * ways and the distinction is the whole debugging story.
 */
const MEANING = {
	200: 'submitted',
	202: 'accepted — key validation still pending',
	400: 'bad request: the payload was malformed',
	// A first-ever submission can answer 403 while the key file is still being
	// fetched for the first time — biblehearth.online did, then took the same
	// payload on the very next try. Retry once before going looking for a
	// hosting problem that is not there.
	403: 'forbidden: the key file did not validate — if this is the first ever submission, retry once',
	422: 'unprocessable: a URL is not on this host, or the key does not match',
	429: 'rate limited: IndexNow is reading this as spam — slow down',
};

const root = new URL('../', import.meta.url);
const publicDir = fileURLToPath(new URL('public/', root));

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fromSitemap = args.includes('--sitemap');
const targets = args.filter((arg) => !arg.startsWith('--'));

if (!fromSitemap && targets.length === 0) {
	fail('usage: node scripts/indexnow.mjs [--sitemap] [--dry-run] <url|path>...');
}

// The one source of truth for the canonical host, so this cannot drift from
// what the sitemaps and canonical tags emit.
const { default: config } = await import(new URL('astro.config.mjs', root).href);
const site = new URL(config.site);

const { key, keyLocation } = await readKey();

const urls = [
	...new Set([
		...(fromSitemap ? await sitemapUrls() : []),
		...targets.map(canonical),
	]),
];

if (urls.length === 0) {
	fail('nothing to submit');
}

console.log(`${urls.length} URL${urls.length === 1 ? '' : 's'} for ${site.host}`);
console.log(`key ${key} at ${keyLocation}`);

if (dryRun) {
	for (const url of urls) {
		console.log(`  ${url}`);
	}
	console.log('\n--dry-run: nothing sent.');
	process.exit(0);
}

let failed = 0;

for (let start = 0; start < urls.length; start += BATCH_LIMIT) {
	const batch = urls.slice(start, start + BATCH_LIMIT);
	const response = await fetch(ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
		body: JSON.stringify({ host: site.host, key, keyLocation, urlList: batch }),
	});

	const meaning = MEANING[response.status] ?? (await response.text()).trim();
	const line = `${batch.length} URLs → ${response.status} ${meaning}`;

	// 202 is a success: the key is being checked out of band, and the URLs are
	// already queued. Treating it as a failure would send us re-submitting.
	if (response.ok) {
		console.log(line);
	} else {
		console.error(line);
		failed += 1;
	}
}

if (failed > 0) {
	process.exit(1);
}

console.log('\nVerify at https://www.bing.com/webmasters — Indexing → IndexNow.');

/**
 * Find the hosted key, and check it is hosted correctly while we are here.
 *
 * The key is deliberately public — it is served at the site root — so it lives
 * in the repo rather than in an env var, and reading it back from public/ is
 * what keeps the payload and the file from disagreeing. A file only counts if
 * its contents match its own name, which is both the spec's rule and what
 * tells a key file apart from any other .txt in public/.
 */
async function readKey() {
	const found = [];

	for (const name of await readdir(publicDir)) {
		const match = KEY_FILE.exec(name);
		if (!match) {
			continue;
		}
		const contents = (await readFile(join(publicDir, name), 'utf8')).trim();
		if (contents === match[1]) {
			found.push(name);
		}
	}

	if (found.length === 0) {
		fail(`no IndexNow key file in ${publicDir} — generate one at https://www.bing.com/indexnow/getstarted`);
	}
	if (found.length > 1) {
		fail(`more than one IndexNow key file in ${publicDir}: ${found.join(', ')}`);
	}

	return {
		key: found[0].replace(/\.txt$/, ''),
		keyLocation: new URL(`/${found[0]}`, site).href,
	};
}

/** Every URL the site currently submits, read back out of the live sitemaps. */
async function sitemapUrls() {
	const children = locs(await fetchText(new URL('/sitemap.xml', site)));
	const found = [];

	for (const child of children) {
		found.push(...locs(await fetchText(new URL(child))));
	}

	return found.map(canonical);
}

async function fetchText(url) {
	const response = await fetch(url);
	if (!response.ok) {
		fail(`${url} returned ${response.status}`);
	}
	return await response.text();
}

function locs(xml) {
	return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => unescapeXml(match[1].trim()));
}

function unescapeXml(value) {
	// &amp; last, so an escaped entity is not decoded twice.
	return value
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&apos;', "'")
		.replaceAll('&amp;', '&');
}

/**
 * The exact string the site would serve, or an early exit.
 *
 * A URL on another host comes back 422 for the whole batch rather than for the
 * one bad entry, so it is worth refusing before the request. Trailing slashes
 * go because astro.config sets trailingSlash: 'never' — submitting one asks a
 * crawler to spend a fetch on a redirect.
 */
function canonical(arg) {
	let url;
	try {
		url = new URL(arg, site);
	} catch {
		fail(`not a URL or a path: ${arg}`);
	}

	if (url.host !== site.host) {
		fail(`${arg} is not on ${site.host} — IndexNow answers 422 for the whole batch`);
	}

	url.hash = '';
	if (url.pathname.length > 1) {
		url.pathname = url.pathname.replace(/\/+$/, '');
	}

	return url.href;
}

function fail(message) {
	console.error(message);
	process.exit(1);
}
