import assert from 'node:assert/strict';
import test from 'node:test';
import { createUpstreamLimiter, UpstreamBusyError } from '../src/lib/cache/limiter';

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

test('a full pending queue rejects immediately without starting work, then drains in order', async () => {
	const limit = createUpstreamLimiter({ maxConcurrent: 1, maxWaiting: 2 });
	const gate = deferred();
	const started: number[] = [];
	const first = limit(async () => {
		started.push(1);
		await gate.promise;
	});
	const second = limit(async () => {
		started.push(2);
	});
	const third = limit(async () => {
		started.push(3);
	});
	await assert.rejects(
		limit(async () => {
			started.push(4);
		}),
		UpstreamBusyError,
	);
	assert.deepEqual(started, [1]);
	gate.resolve();
	await Promise.all([first, second, third]);
	await limit(async () => {
		started.push(5);
	});
	assert.deepEqual(started, [1, 2, 3, 5]);
});

test('timed-out waiters release queue capacity and never run', async () => {
	const limit = createUpstreamLimiter({ maxConcurrent: 1, maxWaiting: 1, maxWaitMs: 15 });
	const gate = deferred();
	const keepAlive = setTimeout(() => {}, 1000);
	let timedOutRan = false;
	const first = limit(async () => {
		await gate.promise;
	});
	try {
		await assert.rejects(
			limit(async () => {
				timedOutRan = true;
			}),
			UpstreamBusyError,
		);
		const replacement = limit(async () => 'replacement');
		gate.resolve();
		assert.equal(await replacement, 'replacement');
		await first;
		assert.equal(timedOutRan, false);
	} finally {
		gate.resolve();
		clearTimeout(keepAlive);
	}
});

test('failed operations release their active slot for a waiting caller', async () => {
	const limit = createUpstreamLimiter({ maxConcurrent: 1, maxWaiting: 1 });
	const first = limit(async () => {
		throw new Error('fixture failure');
	});
	const next = limit(async () => 'recovered');
	await assert.rejects(first, /fixture failure/);
	assert.equal(await next, 'recovered');
});
