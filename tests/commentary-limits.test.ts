import assert from 'node:assert/strict';
import test from 'node:test';
import {
	MAX_COMMENTARY_RESPONSE_BYTES,
	readCommentaryResponse,
} from '../src/lib/commentary/response';
import { loadBookOverviews, loadChapterCommentary } from '../src/lib/commentary/api';

test('commentary response is read as UTF-8 across chunks and validates its shape', async () => {
	const expected = {
		book: { introduction: 'A book introduction.' },
		chapter: {
			introduction: 'A chapter introduction.',
			content: [{ type: 'verse', number: 1, content: ['Text é and John 3:16.', { type: 'note' }] }],
		},
	};
	const bytes = new TextEncoder().encode(JSON.stringify(expected));
	const split = bytes.indexOf(0xc3) + 1;
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(bytes.slice(0, split));
			controller.enqueue(bytes.slice(split));
			controller.close();
		},
	});
	assert.deepEqual(await readCommentaryResponse(new Response(stream)), expected);
});

test('commentary rejects oversized streamed responses even with a misleading length', async () => {
	let cancelled = false;
	let pulls = 0;
	const stream = new ReadableStream<Uint8Array>({
		pull(controller) {
			pulls += 1;
			controller.enqueue(new Uint8Array(3 * 1024 * 1024));
		},
		cancel() {
			cancelled = true;
		},
	});
	const response = new Response(stream, { headers: { 'Content-Length': '1' } });
	await assert.rejects(readCommentaryResponse(response), /too large/);
	assert.equal(cancelled, true);
	assert.ok(pulls <= 3, 'stop reading once the real byte limit is reached');
	assert.ok(MAX_COMMENTARY_RESPONSE_BYTES < 6 * 1024 * 1024);
});

test('commentary rejects malformed and excessive structures without accepting partial text', async () => {
	for (const value of [
		{},
		{ chapter: { content: 'not an array' } },
		{ chapter: { content: Array.from({ length: 4097 }, () => ({ type: 'verse' })) } },
		{ chapter: { introduction: 'word\n'.repeat(8193) } },
		{ chapter: { content: [{ type: 'verse', content: Array(16_385).fill(null) }] } },
	]) {
		await assert.rejects(readCommentaryResponse(Response.json(value)));
	}
});

test('invalid commentary falls back to stale content and is not cached as absence', async () => {
	const originalFetch = globalThis.fetch;
	const originalNow = Date.now;
	const now = originalNow();
	let calls = 0;
	globalThis.fetch = async () => {
		calls += 1;
		return calls === 1
			? Response.json({ chapter: { introduction: 'Grace and truth.', content: [] } })
			: Response.json({ chapter: { content: 'not an array' } });
	};
	try {
		Date.now = () => now;
		const first = await loadChapterCommentary('tyndale', 'JHN', 17);
		assert.deepEqual(first?.introduction, ['Grace and truth.']);
		Date.now = () => now + 31 * 24 * 60 * 60 * 1000;
		assert.deepEqual(await loadChapterCommentary('tyndale', 'JHN', 17), first);
		assert.equal(calls, 2);
	} finally {
		globalThis.fetch = originalFetch;
		Date.now = originalNow;
	}
});

test('a malformed source does not prevent another book overview from rendering', async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (input) => {
		const url = String(input);
		if (url.includes('/tyndale/')) {
			return Response.json({ book: { introduction: 'A reliable introduction.' } });
		}
		if (url.includes('/matthew-henry/')) {
			return Response.json({ book: { introduction: { unexpected: true } } });
		}
		return new Response(null, { status: 404 });
	};
	try {
		const overviews = await loadBookOverviews('JHN');
		assert.equal(overviews.length, 1);
		assert.equal(overviews[0]?.source.id, 'tyndale');
		assert.deepEqual(overviews[0]?.introduction, ['A reliable introduction.']);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
