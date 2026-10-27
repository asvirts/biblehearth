import assert from 'node:assert/strict';

const args = process.argv.slice(2);
const base = new URL(args.find((arg) => /^https?:/.test(arg)) || 'http://localhost:3000');
const unavailable = args.includes('--unavailable');
const live = args.includes('--live-readers');
let count = 0;
const checks = [
	['/', 200],
	['/study', 200],
	['/topics', 200],
	['/answers', 200],
	['/about', 200],
	['/contact', 200],
	['/privacy', 200],
	['/attributions', 200],
	['/genesis/51', 404],
	['/not-a-real-book/1', 404],
	['/commentary/psalms/28', 301],
	['/psa/28', 301],
	['/read?version=niv&book=psalms&chapter=28', 302],
	['/api/warm', 401],
	['/api/i18n-smoke', 404],
	['/sitemap.xml', 200],
	['/sitemap-topics.xml', 200],
	['/sitemap-answers.xml', 200],
	['/sitemap-commentary.xml', 200],
	['/llms.txt', 200],
	['/psalms/28.md', 200],
	['/pt/salmo/91.md', 200],
	['/topics/anxiety.md', 200],
	['/answers/nephilim-in-the-bible.md', 200],
	['/genesis/2.md', 404],
];
if (unavailable)
	checks.push(
		['/verse/psalms/28/1', 503],
		['/bible/niv/psalms/28', 503],
		['/verse-of-the-day', 503],
		['/topics/anxiety', 200],
	);
if (live)
	checks.push(
		['/versions', 200],
		['/verse-of-the-day', 200],
		['/bible/niv', 200],
		['/bible/niv/psalms', 200],
		['/bible/niv/psalms/28', 200],
		['/bible/niv/psalms/28/1', 200],
		['/verse/psalms/28/1', 200],
		['/psalms/28', 200],
		['/pt/salmo/91', 200],
		['/ar/bible/keh/مزمور/91', 200],
	);
for (const [path, status] of checks) {
	const response = await fetch(new URL(path, base), { redirect: 'manual' });
	assert.equal(response.status, status, `${path}: HTTP status`);
	const body = await response.text();
	const type = response.headers.get('content-type') || '';
	if (type.includes('text/html')) {
		const head = body.split('</head>')[0];
		assert.equal((head.match(/<title\b/g) || []).length, 1, `${path}: one title`);
		assert.equal((body.match(/<h1\b/g) || []).length, 1, `${path}: one primary heading`);
		if (status === 200)
			assert.equal((head.match(/rel="canonical"/g) || []).length, 1, `${path}: canonical`);
		if (status === 404) assert.match(head, /noindex/, `${path}: excluded missing page`);
		assert.doesNotMatch(
			body,
			/YVP_APP_KEY|CRON_SECRET|Add .*environment/,
			`${path}: no private configuration copy`,
		);
		for (const match of head.matchAll(
			/<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs,
		))
			JSON.parse(match[1]);
		if (status === 503) {
			assert.equal(response.headers.get('retry-after'), '300', `${path}: retry instruction`);
			assert.equal(response.headers.get('cache-control'), 'no-store', `${path}: no cached failure`);
		}
		if (live && path.startsWith('/bible/niv/psalms/28'))
			assert.match(
				body.match(/<footer class="copyright">[\s\S]*?<\/footer>/)?.[0] || '',
				/Biblica/,
				`${path}: detailed publisher notice`,
			);
		if (path.startsWith('/ar/')) {
			assert.match(body, /<html[^>]*lang="ar"/);
			assert.match(body, /<html[^>]*dir="rtl"/);
		}
	}
	if (path.endsWith('.md')) {
		assert.equal(
			response.headers.get('x-robots-tag'),
			'noindex',
			`${path}: markdown twin index policy`,
		);
		if (status === 200) assert.match(type, /text\/markdown/);
		assert.doesNotMatch(
			body,
			/<div class="yv-|<span class="yv-/,
			`${path}: no Scripture HTML export`,
		);
	}
	if (path.includes('sitemap') && status === 200) {
		assert.match(type, /xml/);
		assert.match(body, /<(?:urlset|sitemapindex)\b/);
	}
	if (path === '/read?version=niv&book=psalms&chapter=28')
		assert.equal(response.headers.get('location'), '/bible/niv/psalms/28');
	count++;
}
const home = await fetch(base);
const etag = home.headers.get('etag');
if (etag) {
	const conditional = await fetch(base, {
		headers: { 'If-None-Match': etag, 'Cache-Control': 'max-age=0' },
	});
	assert.equal(conditional.status, 304, 'conditional HTML request');
	count++;
}
console.log(
	`Verified ${count} production-server responses${unavailable ? ' including unavailable-upstream behavior' : ''}${live ? ' including bounded live reader/locale checks' : ''}.`,
);
