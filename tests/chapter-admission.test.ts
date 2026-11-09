import assert from 'node:assert/strict';
import test from 'node:test';
import type { BiblePassage } from '@youversion/platform-core';
import { buildPageContext } from '../src/lib/page/context';
import { RouteControl } from '../src/lib/page/navigation';
import type { IndexedBible } from '../src/lib/youversion/api';
import { loadVerseHub } from '../src/loaders/readers/verse-hub';
import { readIndexedChapter } from '../src/loaders/readers/version-chapter';

test('public verse hubs reject invalid chapters before invoking the passage source', async () => {
	for (const chapter of ['22', '23']) {
		const context = buildPageContext(new Request(`https://example.test/verse/john/${chapter}/1`), {
			book: 'john', chapter, verse: '1',
		});
		let sourceCalls = 0;
		await assert.rejects(
			loadVerseHub(context, async () => {
				sourceCalls++;
				return { renderings: [], status: 503, headers: new Headers() };
			}),
			(error: unknown) => error instanceof RouteControl && error.status === 404,
		);
		assert.equal(sourceCalls, 0);
	}
});

test('version chapter text is loaded only after that version index admits the chapter', async () => {
	const index = {
		books: [
			{ id: 'JHN', chapters: [{ id: '21' }] },
			// A translation may carry chapters beyond the shared canon, or books
			// outside it. Its own index, rather than a fixed table, is authoritative.
			{ id: 'EST', chapters: [{ id: '12' }] },
			{ id: 'TOB', chapters: [{ id: '2' }] },
		],
	} as unknown as IndexedBible;
	const calls: Array<[number, string]> = [];
	const loadPassage = async (versionId: number, usfm: string): Promise<BiblePassage> => {
		calls.push([versionId, usfm]);
		return { id: usfm, content: '<p>Test passage</p>' } as BiblePassage;
	};

	assert.equal(await readIndexedChapter(index, 111, 'JHN', '22', loadPassage), null);
	assert.equal(await readIndexedChapter(index, 111, 'JHN', '23', loadPassage), null);
	assert.deepEqual(calls, []);
	assert.ok(await readIndexedChapter(index, 111, 'JHN', '21', loadPassage));
	assert.ok(await readIndexedChapter(index, 111, 'EST', '12', loadPassage));
	assert.ok(await readIndexedChapter(index, 111, 'TOB', '2', loadPassage));
	assert.deepEqual(calls, [[111, 'JHN.21'], [111, 'EST.12'], [111, 'TOB.2']]);
});
