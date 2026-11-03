#!/usr/bin/env node
/** Run against a running production server: node scripts/verify-html-validators.mjs [origin] */
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';

const base = new URL(process.argv[2] ?? 'http://localhost:3000');
const reviewedDate = 'Tue, 27 Oct 2026 00:00:00 GMT';
const futureDate = 'Fri, 01 Jan 2100 00:00:00 GMT';

async function request(path, headers = {}) {
	const url = new URL(path, base);
	const transport = url.protocol === 'https:' ? https : http;
	return new Promise((resolve, reject) => {
		const req = transport.get(
			url,
			{ headers: { 'accept-encoding': 'identity', ...headers } },
			(res) => {
				const chunks = [];
				res.on('data', (chunk) => chunks.push(chunk));
				res.on('error', reject);
				res.on('end', () =>
					resolve({
						response: { status: res.statusCode, headers: new Headers(res.headers) },
						body: Buffer.concat(chunks).toString('utf8'),
					}),
				);
			},
		);
		req.setTimeout(30000, () => req.destroy(new Error('Request timed out')));
		req.on('error', reject);
	});
}

function checkArticle(result, label) {
	const { response, body } = result;
	assert.equal(response.status, 200, `${label}: expected 200`);
	assert.equal(
		response.headers.get('last-modified'),
		null,
		`${label}: date must not validate composed HTML`,
	);
	assert.match(
		response.headers.get('content-type') ?? '',
		/text\/html/i,
		`${label}: expected HTML`,
	);
	assert.match(body, /<!doctype html/i, `${label}: missing HTML document`);
	assert.match(body, /<h1[^>]*>[^<]*peace/i, `${label}: missing peace article`);
	assert.match(body, /<\/html>/i, `${label}: incomplete HTML document`);
	const cache = response.headers.get('cache-control') ?? '';
	assert.match(cache, /\bpublic\b/i, `${label}: missing public cache policy`);
	assert.match(cache, /\bmax-age=[1-9]\d*/i, `${label}: missing positive cache lifetime`);
}

try {
	const initial = await request('/topics/peace');
	checkArticle(initial, 'initial request');
	const etag = initial.response.headers.get('etag');
	assert.ok(etag, 'initial request: missing HTML ETag');

	for (const date of [reviewedDate, futureDate]) {
		checkArticle(
			await request('/topics/peace', { 'if-modified-since': date }),
			`If-Modified-Since ${date}`,
		);
	}

	const matching = await request('/topics/peace', { 'if-none-match': etag });
	assert.equal(matching.response.status, 304, 'matching ETag: expected 304');
	assert.equal(matching.body, '', 'matching ETag: 304 must have no body');

	let staleEtag = '"validator-regression-stale"';
	if (staleEtag === etag) staleEtag = '"validator-regression-other"';
	checkArticle(
		await request('/topics/peace', {
			'if-none-match': staleEtag,
			'if-modified-since': futureDate,
		}),
		'stale ETag with future If-Modified-Since',
	);

	const missing = await request('/genesis/51', { 'if-modified-since': futureDate });
	assert.equal(missing.response.status, 404, 'invalid chapter: expected 404');
	assert.match(
		missing.body,
		/<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i,
		'invalid chapter: expected noindex robots meta',
	);
	assert.match(
		missing.response.headers.get('cache-control') ?? '',
		/\bmax-age=[1-9]\d*/i,
		'invalid chapter: missing positive cache lifetime',
	);
	console.log(`HTML validator checks passed for ${base.origin}`);
} catch (error) {
	console.error(`HTML validator checks failed for ${base.origin}: ${error.message}`);
	process.exitCode = 1;
}
