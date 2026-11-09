import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCached, peekCached } from '../src/lib/cache/store';

test('local cache evicts old entries when their estimated byte budget is reached', async () => {
	// Large enough that the independent Runtime Cache item limit rejects each
	// fixture, so a later peek cannot be filled by its fallback implementation.
	const value = 'x'.repeat(1_600_000);
	const warning = console.warn;
	console.warn = () => {};
	try {
		for (let i = 0; i < 11; i += 1) {
			await loadCached(`test:cache-budget:${i}`, 60_000, 0, async () => value);
		}
		assert.equal(await peekCached('test:cache-budget:0'), undefined);
		assert.equal(await peekCached('test:cache-budget:10'), value);
	} finally {
		console.warn = warning;
	}
});

test('oversized refreshed values do not evict an existing stale fallback', async () => {
	const key = 'test:cache-budget:stale';
	const tooLarge = 'x'.repeat(2_200_000);
	const warning = console.warn;
	console.warn = () => {};
	try {
		assert.equal(await loadCached(key, -1, 60_000, async () => 'stale value'), 'stale value');
		assert.equal(await loadCached(key, -1, 60_000, async () => tooLarge), tooLarge);
		assert.equal(
			await loadCached(key, -1, 60_000, async () => {
				throw new Error('offline');
			}),
			'stale value',
		);
	} finally {
		console.warn = warning;
	}
});

test('remote item limits measure UTF-8 bytes rather than JavaScript characters', async () => {
	const originalWarning = console.warn;
	const warnings: string[] = [];
	console.warn = (message) => {
		warnings.push(String(message));
	};
	try {
		await loadCached('test:cache-budget:unicode', 60_000, 0, async () => 'ا'.repeat(800_000));
		assert.ok(warnings.some((message) => message.includes('not cached remotely')));
	} finally {
		console.warn = originalWarning;
	}
});
