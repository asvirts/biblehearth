import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { dispatchResource, isResourcePath } from '../src/resources/dispatch';
import { bookSlug } from '../src/lib/bible/books';
import { localeForCode } from '../src/lib/i18n/locales';

const origin = 'https://biblehearth.online';
const get = (path: string, init?: RequestInit) =>
	dispatchResource(new Request(`${origin}${path}`, init));

test('sitemap index is upstream-independent, complete, and negotiates gzip', async () => {
	const plain = await get('/sitemap.xml');
	assert.equal(plain.status, 200);
	assert.match(plain.headers.get('content-type') ?? '', /^application\/xml/);
	assert.equal(plain.headers.get('content-encoding'), null);
	assert.match(plain.headers.get('vary') ?? '', /Accept-Encoding/i);
	const xml = await plain.text();
	assert.match(xml, /<sitemapindex/);
	assert.match(xml, /https:\/\/biblehearth\.online\/sitemap-verses\.xml/);
	assert.match(xml, /https:\/\/biblehearth\.online\/sitemap-locale\/pt\.xml/);
	assert.ok((xml.match(/<sitemap>/g) ?? []).length > 50);

	const compressed = await get('/sitemap.xml', { headers: { 'accept-encoding': 'gzip' } });
	assert.equal(compressed.headers.get('content-encoding'), 'gzip');
	assert.equal(gunzipSync(Buffer.from(await compressed.arrayBuffer())).toString(), xml);
});

test('chapter markdown is noindex and carries original writing and citation links', async () => {
	const response = await get('/psalms/28.md');
	assert.equal(response.status, 200);
	assert.equal(response.headers.get('x-robots-tag'), 'noindex');
	assert.match(response.headers.get('content-type') ?? '', /^text\/markdown/);
	assert.match(response.headers.get('cache-control') ?? '', /s-maxage/);
	const body = await response.text();
	assert.match(body, /^# .*Psalm 28/m);
	assert.match(body, /https:\/\/biblehearth\.online\/verse\/psalms\/28\//);
	assert.doesNotMatch(body, /The LORD is my shepherd; I shall not want/);
});

test('chapter without a brief and unknown editorial twins are noindex 404s', async () => {
	for (const path of ['/genesis/12.md', '/topics/no-such-topic.md', '/answers/no-such-answer.md']) {
		const response = await get(path);
		assert.equal(response.status, 404, path);
		assert.equal(response.headers.get('x-robots-tag'), 'noindex', path);
	}
});

test('aliases redirect to the correct canonical markdown twin', async () => {
	const response = await get('/psa/28.md');
	assert.equal(response.status, 301);
	assert.equal(response.headers.get('location'), `${origin}/psalms/28.md`);
});

test('localized unicode routes retain locale and publisher book spelling', async () => {
	const locale = localeForCode('ru');
	assert.ok(locale);
	const slug = bookSlug(locale, 'PSA');
	assert.match(slug, /[^\x00-\x7f]/);
	const query = new URLSearchParams({ version: 'нрп', book: slug, chapter: '90' });
	const response = await get(`/ru/read?${query}`);
	assert.equal(response.status, 302);
	const location = new URL(response.headers.get('location')!, origin);
	assert.equal(location.origin, origin);
	assert.equal(decodeURIComponent(location.pathname), `/ru/bible/нрп/${slug}/90`);
});

test('Portuguese chapter twin preserves locale and canonical URL', async () => {
	const locale = localeForCode('pt');
	assert.ok(locale);
	const slug = bookSlug(locale, 'PSA');
	const response = await get(`/pt/${encodeURIComponent(slug)}/91.md`);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get('x-robots-tag'), 'noindex');
	const body = await response.text();
	assert.match(body, /Salmo 91/);
	assert.ok(
		body.includes(`${origin}/pt/${slug}/91`) ||
			body.includes(`${origin}/pt/${encodeURIComponent(slug)}/91`),
	);
});

test('read rejects unsafe or malformed input without contacting upstream', async () => {
	assert.equal((await get('/read?version=niv&book=unknown&chapter=1')).status, 404);
	assert.equal((await get('/read?version=niv&book=john&chapter=not-a-number')).status, 400);
	assert.equal((await get('/read?version=niv&book=john%2Fgenesis&chapter=1')).status, 400);
	const outOfRange = await get('/read?version=niv&book=ruth&chapter=119');
	assert.equal(outOfRange.status, 302);
	assert.equal(outOfRange.headers.get('location'), '/bible/niv/ruth');
});

test('warmer refuses unauthenticated requests before any API work', async () => {
	const response = await get('/api/warm');
	assert.equal(response.status, 401);
	assert.equal(await response.text(), 'Unauthorized');
	const head = await get('/api/warm', { method: 'HEAD' });
	assert.equal(head.status, 405);
	assert.equal(head.headers.get('allow'), 'GET');
});

test('dispatch recognizes resources without swallowing regular pages', async () => {
	for (const path of ['/sitemap.xml', '/sitemap-locale/pt.xml', '/pt/salmo/91.md', '/api/warm']) {
		assert.equal(isResourcePath(path), true, path);
	}
	for (const path of ['/', '/psalms/28', '/topics/anxiety', '/styles/main.css']) {
		assert.equal(isResourcePath(path), false, path);
	}
	const unknown = await get('/not-a-resource');
	assert.equal(unknown.status, 404);
	const post = await get('/sitemap.xml', { method: 'POST' });
	assert.equal(post.status, 405);
	assert.equal(post.headers.get('allow'), 'GET, HEAD');
	const head = await get('/sitemap.xml', { method: 'HEAD' });
	assert.equal(head.status, 200);
	assert.equal(await head.text(), '');
});

test('editorial sitemaps contain canonical content and omit unbriefed chapters', async () => {
	const cases = [
		['/sitemap-topics.xml', `${origin}/topics/anxiety`],
		['/sitemap-answers.xml', `${origin}/answers/what-is-the-unforgivable-sin`],
		['/sitemap-commentary.xml', `${origin}/psalms/28`],
	] as const;
	for (const [path, expected] of cases) {
		const response = await get(path);
		assert.equal(response.status, 200, path);
		const xml = await response.text();
		assert.match(xml, /<urlset/);
		assert.ok(xml.includes(expected), path);
		assert.ok(!xml.includes(`${origin}/genesis/12`), path);
		assert.ok(!xml.includes(`${origin}/psalms/28.md`), path);
	}
});

test('topic and answer twins are original noindex markdown', async () => {
	for (const [path, title, citation] of [
		['/topics/anxiety.md', 'Anxiety', '/verse/'],
		['/answers/what-is-the-unforgivable-sin.md', 'Unforgivable', '/verse/'],
	] as const) {
		const response = await get(path);
		assert.equal(response.status, 200, path);
		assert.equal(response.headers.get('x-robots-tag'), 'noindex', path);
		const text = await response.text();
		assert.match(text.toLowerCase(), new RegExp(title.toLowerCase()), path);
		assert.ok(text.includes(citation), path);
	}
});

test('llms index presents original writing and links to reading hubs', async () => {
	const response = await get('/llms.txt');
	assert.equal(response.status, 200);
	assert.match(response.headers.get('content-type') ?? '', /^text\/plain/);
	const body = await response.text();
	assert.match(body, /BibleHearth/);
	assert.ok(body.includes(`${origin}/study`));
	assert.ok(body.includes(`${origin}/psalms/28`));
	assert.ok(!body.includes(`${origin}/verse/psalms/28/1`));
});

test('invalid locale and unsafe version sitemap requests fail before API access', async () => {
	assert.equal((await get('/sitemap-locale/not-a-language.xml')).status, 404);
	assert.equal((await get('/sitemap-bible/%24.xml')).status, 404);
});

test('locale diagnostic is unavailable outside development', async () => {
	const environment: Record<string, string | undefined> = process.env;
	const previous = environment.NODE_ENV;
	try {
		environment.NODE_ENV = 'production';
		assert.equal((await get('/pt/api/i18n-smoke')).status, 404);
	} finally {
		if (previous === undefined) delete environment.NODE_ENV;
		else environment.NODE_ENV = previous;
	}
});
