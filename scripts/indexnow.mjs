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
 *   node scripts/indexnow.mjs --changed --dry-run
 *   node scripts/indexnow.mjs --sitemap --dry-run
 *
 * `--changed` is the automatic one: it works out which pages actually changed
 * since the last production build and submits only those. It runs from the
 * `postbuild` npm script, so shipping a brief is the whole of the workflow —
 * there is no step to forget. See changedUrls() for how it knows.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://api.indexnow.org/IndexNow';

/** Protocol ceiling for a single POST. */
const BATCH_LIMIT = 10_000;

/** The spec's key rule: 8-128 of [a-zA-Z0-9-], hosted as a bare .txt file. */
const KEY_FILE = /^([a-zA-Z0-9-]{8,128})\.txt$/;

/**
 * The authored content, and the URL each file becomes.
 *
 * Only files a person writes are listed. Reader pages are excluded because
 * nothing about them changes between deploys — the Scripture on them is fixed
 * and the markup is not a content change — and telling Bing otherwise on every
 * build is the resubmission-as-spam pattern this script exists to avoid.
 *
 * The mapping leans on the filename convention (`psalms-28.md` → `/psalms/28`),
 * which is what the chapter-brief skill generates and what the collection ids
 * already are.
 */
const AUTHORED = [
	{
		dir: 'src/content/chapters',
		// A new brief also changes the book page it is listed on, which marks
		// which of its chapters have been written up.
		urls: (id) => {
			const cut = id.lastIndexOf('-');
			const book = id.slice(0, cut);
			const chapter = id.slice(cut + 1);
			return cut < 1 || !/^\d+$/.test(chapter)
				? []
				: [`/${book}/${chapter}`, `/${book}`];
		},
	},
	{ dir: 'src/content/topics', urls: (id) => [`/topics/${id}`] },
	{ dir: 'src/content/answers', urls: (id) => [`/answers/${id}`] },
];

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

/**
 * Where the last build's fingerprints are kept.
 *
 * `node_modules/.cache` is the one directory Vercel restores between builds, so
 * it is the only place a build step can leave itself a note. Losing it is not a
 * failure — see changedUrls(), which treats an absent manifest as "submit
 * nothing" rather than "submit everything".
 */
const MANIFEST = fileURLToPath(
	new URL('node_modules/.cache/indexnow/manifest.json', root),
);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fromSitemap = args.includes('--sitemap');
const onlyChanged = args.includes('--changed');
const ifProduction = args.includes('--if-production');
const targets = args.filter((arg) => !arg.startsWith('--'));

/**
 * The postbuild guard.
 *
 * Preview deployments build the same commit as production and would otherwise
 * announce it twice — the second time from a URL that is not the canonical
 * host. Bailing here rather than in package.json keeps the reason with the
 * code, and keeps `npm run indexnow -- --changed --dry-run` working locally.
 */
if (ifProduction && process.env.VERCEL_ENV !== 'production') {
	console.log(
		`Skipping IndexNow: VERCEL_ENV is ${process.env.VERCEL_ENV ?? 'unset'}, not production.`,
	);
	process.exit(0);
}

if (!fromSitemap && !onlyChanged && targets.length === 0) {
	fail(
		'usage: node scripts/indexnow.mjs [--changed|--sitemap] [--dry-run] <url|path>...',
	);
}

// The one source of truth for the canonical host, so this cannot drift from
// what the sitemaps and canonical tags emit.
const { default: config } = await import(new URL('astro.config.mjs', root).href);
const site = new URL(config.site);

const { key, keyLocation } = await readKey();

/** The manifest --changed will write once the submission is confirmed. */
let pending = null;

const urls = [
	...new Set([
		...(fromSitemap ? await sitemapUrls() : []),
		...(onlyChanged ? await changedUrls() : []),
		...targets.map(canonical),
	]),
];

if (urls.length === 0) {
	// Nothing changed is the ordinary outcome of a deploy that touched code
	// rather than content, so it exits clean. Asked for a specific URL and given
	// none, it is a usage error.
	if (onlyChanged) {
		// Persist even here: on a first run this is the baseline being laid down,
		// and without it every build would keep announcing itself as the first.
		await persistManifest();
		console.log('No content changed since the last build. Nothing submitted.');
		process.exit(0);
	}
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
	const submit = () => fetch(ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
		body: JSON.stringify({ host: site.host, key, keyLocation, urlList: batch }),
	});
	let response = await submit();
	// First-ever submissions can 403 while IndexNow is still fetching the
	// key file; the same payload then succeeds. Retry once, then report.
	if (response.status === 403) {
		response = await submit();
	}

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
	// A submission that failed is not a deploy that failed. The manifest stays
	// unwritten either way, so the next build sees the same changes and tries
	// again — which is the retry, and why this can afford to be quiet.
	process.exit(ifProduction ? 0 : 1);
}

await persistManifest();

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

/**
 * The URLs whose authored source changed since the last production build.
 *
 * Every authored file is fingerprinted and the fingerprints compared with the
 * ones the previous build left in the cache. What comes back is the answer to
 * the question IndexNow actually asks — which URLs changed — rather than the
 * whole site, which is the submission that earns a 429 and a mass crawl.
 *
 * Deletions are reported too. Bing asks to be told when a URL goes away, and a
 * brief that was unpublished is exactly that.
 *
 * With no previous manifest — a first run, or a cleared build cache — the
 * answer is nothing. The alternative is to read an empty baseline as "every
 * page is new" and submit the site, which is the failure this whole script is
 * written around; a build that quietly re-establishes the baseline and submits
 * on the next change is the safe way to be wrong.
 */
async function changedUrls() {
	const current = await fingerprints();
	const previous = await readManifest();
	pending = current;

	if (!previous) {
		console.log('No previous manifest — recording a baseline, submitting nothing.');
		return [];
	}

	const changed = Object.keys(current).filter(
		(url) => current[url] !== previous[url],
	);
	const removed = Object.keys(previous).filter((url) => !(url in current));

	if (removed.length) {
		console.log(`${removed.length} removed URL${removed.length === 1 ? '' : 's'}`);
	}

	return [...changed, ...removed];
}

/**
 * URL → fingerprint of everything authored that the URL is built from.
 *
 * A book page is derived from every brief in that book, so its entry is the
 * digest of all of their digests rather than whichever happened to be read
 * last. Sorted first, so the value depends on the contents and not on the order
 * the directory came back in.
 */
async function fingerprints() {
	const parts = new Map();

	for (const { dir, urls } of AUTHORED) {
		const absolute = fileURLToPath(new URL(`${dir}/`, root));
		let names;
		try {
			names = await readdir(absolute);
		} catch {
			// A collection that does not exist yet is not an error.
			continue;
		}

		for (const name of names) {
			if (!/\.mdx?$/.test(name)) {
				continue;
			}
			const body = await readFile(join(absolute, name), 'utf8');
			// Drafts render noindex and are kept out of every sitemap, so
			// announcing one would be pointing Bing at a page it must not index.
			if (isDraft(body)) {
				continue;
			}

			const hash = digest(body);
			for (const path of urls(name.replace(/\.mdx?$/, ''))) {
				const url = canonical(path);
				parts.set(url, [...(parts.get(url) ?? []), hash]);
			}
		}
	}

	return Object.fromEntries(
		[...parts].map(([url, hashes]) => [url, digest(hashes.sort().join(''))]),
	);
}

function digest(value) {
	return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function isDraft(body) {
	const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(body);
	return frontmatter ? /^draft:\s*true\s*$/m.test(frontmatter[1]) : false;
}

async function readManifest() {
	try {
		return JSON.parse(await readFile(MANIFEST, 'utf8'));
	} catch {
		return null;
	}
}

/**
 * Written only once the submission has gone through.
 *
 * Recording the new state before knowing IndexNow accepted it would mean a
 * failed submission is never retried: the next build would compare against a
 * manifest describing changes that were never announced, and see nothing to do.
 */
async function persistManifest() {
	if (!pending || dryRun) {
		return;
	}
	await mkdir(dirname(MANIFEST), { recursive: true });
	await writeFile(MANIFEST, JSON.stringify(pending, null, '\t'));
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
