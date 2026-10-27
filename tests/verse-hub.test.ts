import assert from 'node:assert/strict';
import test from 'node:test';
import type { BiblePassage, BibleVersion } from '@youversion/platform-core';
import { createVerseHub, type VerseHubSource } from '../src/lib/bible/verse-hub.ts';
import { NOTFOUND_CACHE_CONTROL, READER_CACHE_CONTROL } from '../src/lib/http.ts';

const SHORT_CACHE = 'public, max-age=60, s-maxage=300';
const reference = ['PSA', '23', '1'] as const;

function version(id: number, slug: string): BibleVersion {
	return { id, title: slug } as BibleVersion;
}

function passage(id: number): BiblePassage {
	return { id: `PSA.23.1:${id}`, content: `<p>Translation ${id}</p>` } as BiblePassage;
}

function failure(status: number): Error & { status: number } {
	return Object.assign(new Error(`test failure ${status}`), { status });
}

type Read = BiblePassage | null | Error;

function fixture(
	catalog: BibleVersion[],
	reads: (Read | undefined)[],
): { source: VerseHubSource; calls: Array<[number, string, string, string]> } {
	const calls: Array<[number, string, string, string]> = [];
	const source: VerseHubSource = {
		async listVersions() {
			return catalog;
		},
		versionSlug(item) {
			return item.title;
		},
		async getVerseHtml(id, book, chapter, verse) {
			calls.push([id, book, chapter, verse]);
			const read = reads[id];
			if (read instanceof Error) throw read;
			return read ?? null;
		},
		errorStatus(error) {
			return error instanceof Error && 'status' in error ? Number(error.status) : 500;
		},
	};
	return { source, calls };
}

function headers(
	result: { headers: Headers },
	cacheControl: string,
	retryAfter: string | null = null,
) {
	assert.equal(result.headers.get('Cache-Control'), cacheControl);
	assert.equal(result.headers.get('Retry-After'), retryAfter);
}

const niv = version(1, 'niv');
const nasb = version(2, 'nasb2020');
const amp = version(3, 'amp');
const unlicensed = version(4, 'not-in-curated-list');

test('curated licensed translations render in order and preserve the requested reference', async () => {
	const { source, calls } = fixture(
		[amp, unlicensed, nasb, niv],
		[, passage(1), passage(2), passage(3), passage(4)],
	);
	let catalogs = 0;
	const listVersions = source.listVersions;
	source.listVersions = async () => {
		catalogs++;
		return listVersions();
	};

	const result = await createVerseHub(source)(...reference);

	assert.equal(result.status, 200);
	assert.deepEqual(
		result.renderings.map((entry) => entry.slug),
		['niv', 'nasb2020', 'amp'],
	);
	assert.deepEqual(calls, [
		[1, ...reference],
		[2, ...reference],
		[3, ...reference],
	]);
	assert.equal(catalogs, 1);
	headers(result, READER_CACHE_CONTROL);
});

test(
	'selected passages are requested concurrently and remain ordered after completion',
	{ timeout: 2000 },
	async () => {
		const { source } = fixture([amp, nasb, niv], []);
		const pending = new Map<number, (value: BiblePassage) => void>();
		let notifyStarted!: () => void;
		const allStarted = new Promise<void>((resolve) => {
			notifyStarted = resolve;
		});
		source.getVerseHtml = (id) =>
			new Promise<BiblePassage>((resolve) => {
				pending.set(id, resolve);
				if (pending.size === 3) notifyStarted();
			});

		const resultPromise = createVerseHub(source)(...reference);
		await allStarted;
		pending.get(3)!(passage(3));
		pending.get(1)!(passage(1));
		pending.get(2)!(passage(2));
		const result = await resultPromise;

		assert.equal(result.status, 200);
		assert.deepEqual(
			result.renderings.map((entry) => entry.slug),
			['niv', 'nasb2020', 'amp'],
		);
	},
);

test('all definite absences produce a cacheable 404', async () => {
	const { source } = fixture([niv, nasb], [, null, failure(404)]);
	const result = await createVerseHub(source)(...reference);
	assert.equal(result.status, 404);
	assert.deepEqual(result.renderings, []);
	headers(result, NOTFOUND_CACHE_CONTROL);
});

test('definite absences alongside a rendering retain the normal successful cache', async () => {
	const { source } = fixture([niv, nasb, amp], [, passage(1), null, failure(404)]);
	const result = await createVerseHub(source)(...reference);
	assert.equal(result.status, 200);
	assert.deepEqual(
		result.renderings.map((entry) => entry.slug),
		['niv'],
	);
	headers(result, READER_CACHE_CONTROL);
});

for (const reads of [
	[, failure(503), failure(503)],
	[, null, failure(503)],
]) {
	test(`no rendering with a temporary failure is retryable (${reads[1]?.message ?? 'missing'} first)`, async () => {
		const { source } = fixture([niv, nasb], reads);
		const result = await createVerseHub(source)(...reference);
		assert.equal(result.status, 503);
		assert.deepEqual(result.renderings, []);
		headers(result, 'no-store', '300');
	});
}

test('an unexpected failure takes precedence over unavailable and absent translations', async () => {
	const { source } = fixture([niv, nasb, amp], [, failure(503), failure(500), null]);
	const result = await createVerseHub(source)(...reference);
	assert.equal(result.status, 500);
	assert.deepEqual(result.renderings, []);
	headers(result, 'no-store');
});

for (const status of [503, 500]) {
	test(`a rendering with an omitted failed translation remains readable with short caching (${status})`, async () => {
		const { source } = fixture([niv, nasb], [, passage(1), failure(status)]);
		const result = await createVerseHub(source)(...reference);
		assert.equal(result.status, 200);
		assert.deepEqual(
			result.renderings.map((entry) => entry.slug),
			['niv'],
		);
		headers(result, SHORT_CACHE);
	});
}

for (const catalog of [[], [unlicensed]]) {
	test(`no selected translations is unavailable, not a missing verse (${catalog.length} catalog entries)`, async () => {
		const { source, calls } = fixture(catalog, []);
		const result = await createVerseHub(source)(...reference);
		assert.equal(result.status, 503);
		assert.deepEqual(result.renderings, []);
		assert.deepEqual(calls, []);
		headers(result, 'no-store', '300');
	});
}

for (const [catalogStatus, expectedStatus] of [
	[404, 503],
	[503, 503],
	[500, 500],
] as const) {
	test(`catalog failure ${catalogStatus} produces ${expectedStatus}, not a missing verse`, async () => {
		const { source, calls } = fixture([niv], [, passage(1)]);
		source.listVersions = async () => {
			throw failure(catalogStatus);
		};
		const result = await createVerseHub(source)(...reference);
		assert.equal(result.status, expectedStatus);
		assert.deepEqual(calls, []);
		headers(result, 'no-store', expectedStatus === 503 ? '300' : null);
	});
}

test('an unexpected translation-selection failure produces a non-cacheable 500', async () => {
	const { source, calls } = fixture([niv], [, passage(1)]);
	source.versionSlug = () => {
		throw new Error('selection failed');
	};
	const result = await createVerseHub(source)(...reference);
	assert.equal(result.status, 500);
	assert.deepEqual(calls, []);
	headers(result, 'no-store');
});

test('only selected editions receive publisher details before their text renders', async () => {
	const { source, calls } = fixture(
		[unlicensed, nasb, niv],
		[, passage(1), passage(2), , passage(4)],
	);
	const detailCalls: number[] = [];
	source.getVersionDetails = async (item) => {
		detailCalls.push(item.id);
		return { ...item, copyright: `Publisher notice ${item.id}` };
	};
	const result = await createVerseHub(source)(...reference);
	assert.equal(result.status, 200);
	assert.deepEqual(detailCalls, [1, 2]);
	assert.deepEqual(calls, [
		[1, ...reference],
		[2, ...reference],
	]);
	assert.deepEqual(
		result.renderings.map(({ version: item }) => item.copyright),
		['Publisher notice 1', 'Publisher notice 2'],
	);
	headers(result, READER_CACHE_CONTROL);
});

test('a failed publisher detail removes only that rendering and shortens caching', async () => {
	const { source, calls } = fixture([niv, nasb], [, passage(1), passage(2)]);
	source.getVersionDetails = async (item) => {
		if (item.id === 1) throw failure(404);
		return { ...item, copyright: 'NASB notice' };
	};
	const result = await createVerseHub(source)(...reference);
	assert.equal(result.status, 200);
	assert.deepEqual(
		result.renderings.map((entry) => entry.slug),
		['nasb2020'],
	);
	assert.deepEqual(calls, [[2, ...reference]]);
	headers(result, SHORT_CACHE);
});

test('missing publisher details are retryable, never a false verse 404', async () => {
	for (const metadataFailure of [null, failure(404), failure(503)]) {
		const { source, calls } = fixture([niv], [, passage(1)]);
		source.getVersionDetails = async () => {
			if (metadataFailure instanceof Error) throw metadataFailure;
			return metadataFailure;
		};
		const result = await createVerseHub(source)(...reference);
		assert.equal(result.status, 503);
		assert.deepEqual(calls, []);
		headers(result, 'no-store', '300');
	}
});
