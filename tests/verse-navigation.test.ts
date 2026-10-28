import assert from 'node:assert/strict';
import test from 'node:test';
import { adjacentVerse, type VerseNavigationBook } from '../src/lib/bible/verse-navigation';

const books: readonly VerseNavigationBook[] = [
	{
		id: 'GEN',
		chapters: [
			{ id: 'intro', verses: [] },
			{ id: '1', verses: ['1', '2', '3'] },
			{ id: '2', verses: ['1', '2'] },
		],
	},
	{ id: 'EXO', chapters: [{ id: '1', verses: ['1', '2'] }] },
];

test('adjacent verses follow the indexed order within a chapter', () => {
	assert.deepEqual(
		adjacentVerse(books, { bookId: 'GEN', chapterId: '1', verseId: '2' }, 'previous'),
		{ bookId: 'GEN', chapterId: '1', verseId: '1' },
	);
	assert.deepEqual(adjacentVerse(books, { bookId: 'GEN', chapterId: '1', verseId: '2' }, 'next'), {
		bookId: 'GEN',
		chapterId: '1',
		verseId: '3',
	});
});

test('chapter and book boundaries use the adjacent chapter inventory', () => {
	assert.deepEqual(adjacentVerse(books, { bookId: 'GEN', chapterId: '1', verseId: '3' }, 'next'), {
		bookId: 'GEN',
		chapterId: '2',
		verseId: '1',
	});
	assert.deepEqual(
		adjacentVerse(books, { bookId: 'GEN', chapterId: '2', verseId: '1' }, 'previous'),
		{ bookId: 'GEN', chapterId: '1', verseId: '3' },
	);
	assert.deepEqual(adjacentVerse(books, { bookId: 'GEN', chapterId: '2', verseId: '2' }, 'next'), {
		bookId: 'EXO',
		chapterId: '1',
		verseId: '1',
	});
});

test('missing or merged references and Bible ends produce no guessed link', () => {
	assert.equal(adjacentVerse(books, { bookId: 'GEN', chapterId: '1', verseId: '4' }, 'next'), null);
	assert.equal(adjacentVerse(books, { bookId: 'EXO', chapterId: '1', verseId: '2' }, 'next'), null);
	assert.equal(
		adjacentVerse(books, { bookId: 'GEN', chapterId: '1', verseId: '1' }, 'previous'),
		null,
	);
});

test('non-numeric index entries are skipped as non-routable references', () => {
	const withMergedEntry: readonly VerseNavigationBook[] = [
		{ id: 'GEN', chapters: [{ id: '1', verses: ['1', '1a', '2'] }] },
	];
	assert.deepEqual(
		adjacentVerse(withMergedEntry, { bookId: 'GEN', chapterId: '1', verseId: '1' }, 'next'),
		{ bookId: 'GEN', chapterId: '1', verseId: '2' },
	);
});

test('an omitted verse number is skipped instead of being synthesized', () => {
	const omittedVerse: readonly VerseNavigationBook[] = [
		{ id: 'GEN', chapters: [{ id: '1', verses: ['1', '3'] }] },
	];
	assert.deepEqual(
		adjacentVerse(omittedVerse, { bookId: 'GEN', chapterId: '1', verseId: '1' }, 'next'),
		{ bookId: 'GEN', chapterId: '1', verseId: '3' },
	);
	assert.equal(
		adjacentVerse(omittedVerse, { bookId: 'GEN', chapterId: '1', verseId: '2' }, 'next'),
		null,
	);
});
