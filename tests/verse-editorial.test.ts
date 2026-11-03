import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToReadableStream } from 'react-dom/server';
import type { ReactNode } from 'react';

process.env.YVP_APP_KEY = '';
const { loadVerseHub } = await import('../src/loaders/readers/verse-hub');
const { renderVerseHub } = await import('../src/views/readers/verse-hub');
const { DEFAULT_LOCALE } = await import('../src/lib/i18n/locales');
const { DEGRADED_CACHE_CONTROL, ERROR_CACHE_CONTROL } = await import('../src/lib/http');
const { listVerseBriefs } = await import('../src/lib/verse-briefs');
const { GET: verseSitemap } = await import('../src/resources/sitemap-verses.xml');

function context(book: string, chapter: string, verse: string) {
	const site = new URL('https://biblehearth.online');
	const path = `/verse/${book}/${chapter}/${verse}`;
	return {
		site,
		url: new URL(path, site),
		params: { book, chapter, verse },
		locals: { locale: DEFAULT_LOCALE, localePath: path },
		request: new Request(new URL(path, site)),
		response: { status: 200, headers: new Headers() },
		redirect: (): never => {
			throw new Error('Unexpected redirect');
		},
		notFound: (): never => {
			throw new Error('Unexpected 404');
		},
	};
}

test('original verse explanations survive an upstream outage without hiding a retryable reader-only failure', async () => {
	for (const [book, chapter, verse] of [
		['isaiah', '41', '10'],
		['philippians', '4', '6'],
	]) {
		const ctx = context(book!, chapter!, verse!);
		const model = await loadVerseHub(ctx);
		assert.equal(ctx.response.status, 200);
		assert.equal(ctx.response.headers.get('cache-control'), DEGRADED_CACHE_CONTROL);
		assert.equal(ctx.response.headers.get('retry-after'), null);
		assert.equal(ctx.response.headers.get('last-modified'), null);
		assert.equal(model.status, 503);
		assert.ok(model.brief);
		assert.equal(model.nextLink, null);
		const page = renderVerseHub(model);
		const html = await new Response(
			await renderToReadableStream((page.props as { children: ReactNode }).children),
		).text();
		assert.ok(html.includes(model.brief!.title));
		assert.match(html, /Sources and further reading/);
		assert.match(html, /Scripture could not be loaded right now/);
		assert.doesNotMatch(html, /YVP_APP_KEY|CRON_SECRET/);
	}
	const readerOnly = context('psalms', '28', '1');
	await loadVerseHub(readerOnly);
	assert.equal(readerOnly.response.status, 503);
	assert.equal(readerOnly.response.headers.get('cache-control'), ERROR_CACHE_CONTROL);
	assert.equal(readerOnly.response.headers.get('retry-after'), '300');
});

test('authored verse URLs and real review dates remain in the sitemap without Scripture access', async () => {
	const briefs = await listVerseBriefs();
	assert.equal(new Set(briefs.map(({ data }) => data.usfm)).size, briefs.length);
	const xml = await (await verseSitemap(context('isaiah', '41', '10'))).text();
	assert.match(
		xml,
		/<loc>https:\/\/biblehearth.online\/verse\/isaiah\/41\/10<\/loc>\s*<lastmod>2026-10-27/,
	);
	assert.match(
		xml,
		/<loc>https:\/\/biblehearth.online\/verse\/philippians\/4\/6<\/loc>\s*<lastmod>2026-10-27/,
	);
	assert.doesNotMatch(xml, /\.md<\/loc>/);
});

test('original writing never turns a definite missing verse into an indexable success', async () => {
	await assert.rejects(
		loadVerseHub(context('isaiah', '41', '10'), async () => ({
			renderings: [],
			status: 404,
			headers: new Headers(),
		})),
		/Unexpected 404/,
	);
});

test('authored verse leads with original explanation, clear provenance and retained licensed passages', async () => {
	const model = await loadVerseHub(context('isaiah', '41', '10'));
	const version = {
		id: 111,
		abbreviation: 'NIV',
		localized_abbreviation: 'NIV',
		title: 'New International Version',
		localized_title: 'New International Version',
		copyright: 'Publisher copyright test notice',
		info: '',
		publisher_url: 'https://publisher.example',
	};
	const successful = {
		...model,
		status: 200,
		renderings: [{ slug: 'niv', version, passage: { content: '<p>Example licensed passage</p>' } }],
	} as typeof model;
	const page = renderVerseHub(successful);
	assert.equal(page.props.title, model.brief!.title);
	const html = await new Response(
		await renderToReadableStream((page.props as { children: ReactNode }).children),
	).text();
	assert.match(html, /<h1>What Does Isaiah 41:10 Mean/);
	assert.ok(html.indexOf('What does the promise mean?') < html.indexOf('Example licensed passage'));
	assert.ok(
		html.indexOf('Example licensed passage') < html.indexOf('Publisher copyright test notice'),
	);
	assert.match(html, /Compare translations/);
	assert.match(html.replaceAll('<!-- -->', ''), /Reviewed October 27, 2026/);
	assert.match(html, /\/about#editorial-process/);
	assert.match(html, /\/about#corrections/);
	assert.match(html.replaceAll('<!-- -->', ''), /Read the full Isaiah 41 study/);
});

test('chapter links distinguish authored studies from commentary-only chapters', async () => {
	for (const [book, chapter, verse, expected] of [
		['matthew', '13', '12', 'Read the Matthew 13 commentary'],
		['john', '1', '14', 'Read the John 1 commentary'],
	] as const) {
		const model = await loadVerseHub(context(book, chapter, verse));
		assert.equal(model.hasChapterBrief, false);
		const page = renderVerseHub(model);
		const html = await new Response(
			await renderToReadableStream((page.props as { children: ReactNode }).children),
		).text();
		assert.ok(html.replaceAll('<!-- -->', '').includes(expected));
		assert.ok(!html.includes(`Read the full ${book} ${chapter} study`));
	}
});
