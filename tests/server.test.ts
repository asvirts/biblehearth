import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GetServerSidePropsContext } from 'next';
import { getPageProps } from '../src/lib/page/server';
import { loaders } from '../src/lib/page/loaders';
import { matchPage } from '../src/lib/page/routes';

/** A minimal Next request/response pair; no network or Platform key is used. */
function context(
	path: string,
	options: { method?: string; host?: string; requestHeaders?: Record<string, string> } = {},
) {
	const headers = new Map<string, string>();
	const response = {
		statusCode: 200,
		writableEnded: false,
		body: Buffer.alloc(0) as Buffer,
		setHeader(name: string, value: string) {
			headers.set(name.toLowerCase(), String(value));
			return this;
		},
		getHeader(name: string) {
			return headers.get(name.toLowerCase());
		},
		end(body?: Buffer) {
			this.body = body ?? Buffer.alloc(0);
			this.writableEnded = true;
			return this;
		},
	};
	const request = {
		url: path,
		method: options.method ?? 'GET',
		headers: { host: options.host ?? 'localhost:3000', ...options.requestHeaders },
	};
	return {
		ctx: {
			req: request,
			res: response,
			resolvedUrl: path,
			query: {},
			params: {},
		} as unknown as GetServerSidePropsContext,
		response,
	};
}

test('unknown and invalid page routes produce a real, cacheable 404', async () => {
	for (const path of ['/not/a/valid/page', '/not%2Fa/valid/page', '/bad%ZZ/path']) {
		const { ctx, response } = context(path);
		const result = await getPageProps(ctx);
		assert.equal(response.statusCode, 404, path);
		assert.match(response.getHeader('cache-control') ?? '', /s-maxage=86400/, path);
		assert.ok('props' in result, path);
		assert.equal((await result.props).kind, 'NotFound', path);
	}
});

test('legacy paths retain permanent redirects, including localized destinations', async () => {
	for (const [path, destination] of [
		['/commentary', '/study'],
		['/commentary/psalms/28', '/psalms/28'],
		['/pt/commentary/salmo/91', '/pt/salmo/91'],
	] as const) {
		const { ctx } = context(path);
		const result = await getPageProps(ctx);
		assert.ok('redirect' in result, path);
		assert.ok('statusCode' in result.redirect, path);
		assert.equal(result.redirect.statusCode, 301, path);
		assert.equal(result.redirect.destination, destination, path);
	}
});

test('temporary verse failures preserve retryable status and cache headers', async () => {
	const original = loaders.VerseHub;
	loaders.VerseHub = async (page) => {
		page.response.status = 503;
		page.response.headers.set('Cache-Control', 'no-store');
		page.response.headers.set('Retry-After', '300');
		return { reason: 'temporarily unavailable' };
	};
	try {
		const { ctx, response } = context('/verse/john/1/14');
		const result = await getPageProps(ctx);
		assert.equal(response.statusCode, 503);
		assert.equal(response.getHeader('cache-control'), 'no-store');
		assert.equal(response.getHeader('retry-after'), '300');
		assert.ok('props' in result);
		assert.equal((await result.props).kind, 'VerseHub');
	} finally {
		loaders.VerseHub = original;
	}
});

test('localized Unicode book slugs decode once without accepting encoded path separators', () => {
	const result = matchPage('/ru/%D0%BF%D1%81%D0%B0%D0%BB%D0%BE%D0%BC/90');
	assert.equal(result.kind, 'StudyChapter');
	assert.equal(result.params.book, 'псалом');
	assert.equal(result.params.chapter, '90');
	assert.equal(matchPage('/ru/%D0%BF%D1%81%D0%B0%D0%BB%D0%BE%D0%BC%2F90').kind, 'NotFound');
});

test('markdown resources keep their own response and noindex header', async () => {
	const { ctx, response } = context('/psalms/28.md');
	await getPageProps(ctx);
	assert.equal(response.statusCode, 200);
	assert.equal(response.getHeader('x-robots-tag'), 'noindex');
	assert.match(response.getHeader('content-type') ?? '', /^text\/markdown/);
	assert.match(response.body.toString(), /Psalm 28/);
	assert.equal(response.writableEnded, true);
});

test('localized pages report the requested language and right-to-left direction', async () => {
	const original = loaders.VersionChapter;
	loaders.VersionChapter = async (page) => ({ locale: page.locals.locale });
	try {
		const { ctx, response } = context('/ar/bible/keh/%D9%85%D8%B2%D9%85%D9%88%D8%B1/91');
		const result = await getPageProps(ctx);
		assert.equal(response.statusCode, 200);
		assert.equal(response.getHeader('content-language'), 'ar');
		assert.ok('props' in result);
		const props = await result.props;
		assert.equal(props.lang, 'ar');
		assert.equal(props.dir, 'rtl');
	} finally {
		loaders.VersionChapter = original;
	}
});

test('editorial modification dates support 304 while ETag and error responses take precedence', async () => {
	const original = loaders.TopicDetail;
	let status = 200;
	const modified = 'Wed, 21 Oct 2026 00:00:00 GMT';
	loaders.TopicDetail = async (page) => {
		page.response.status = status;
		page.response.headers.set('Last-Modified', modified);
		page.response.headers.set('Cache-Control', status === 200 ? 'public, max-age=60' : 'no-store');
		return {};
	};
	try {
		const fresh = context('/topics/anxiety', { requestHeaders: { 'if-modified-since': modified } });
		await getPageProps(fresh.ctx);
		assert.equal(fresh.response.statusCode, 304);
		assert.equal(fresh.response.writableEnded, true);
		assert.equal(fresh.response.body.length, 0);
		const etag = context('/topics/anxiety', {
			requestHeaders: { 'if-modified-since': modified, 'if-none-match': '"different"' },
		});
		await getPageProps(etag.ctx);
		assert.equal(etag.response.statusCode, 200);
		assert.equal(etag.response.writableEnded, false);
		status = 503;
		const error = context('/topics/anxiety', { requestHeaders: { 'if-modified-since': modified } });
		await getPageProps(error.ctx);
		assert.equal(error.response.statusCode, 503);
		assert.equal(error.response.writableEnded, false);
	} finally {
		loaders.TopicDetail = original;
	}
});
