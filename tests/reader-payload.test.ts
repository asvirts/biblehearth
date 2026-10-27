import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BibleVersion } from '@youversion/platform-core';
import type { IndexedBible } from '../src/lib/youversion/api';
import { BOOK_META } from '../src/lib/bible/usfm';
import { localeForCode } from '../src/lib/i18n/locales';
import BookList from '../src/components/BookList';
import ChapterGrid from '../src/components/ChapterGrid';
import ReaderToolbar from '../src/components/ReaderToolbar';
import {
	projectBookLabel,
	projectBookList,
	projectChapterList,
	projectReaderToolbar,
	projectVersionOptions,
} from '../src/loaders/readers/index-projection';

const testVersion = {
	id: 111,
	abbreviation: 'NIV',
	localized_abbreviation: 'NIV',
	title: 'New International Version',
	localized_title: 'New International Version',
	copyright: 'Copyright Publisher',
	info: '',
	publisher_url: 'https://publisher.example',
} as BibleVersion;
const secondVersion = {
	...testVersion,
	id: 222,
	title: 'Other edition with same abbreviation',
} as BibleVersion;
const catalog = [testVersion, secondVersion];

// A full server-side index includes each verse ID for existence checks. That
// information is deliberately large enough to catch accidental regressions in
// the client payload, but it never includes licensed Scripture text.
const index: IndexedBible = {
	books: BOOK_META.slice(0, 66).map((book, i) => ({
		id: book.usfm,
		title: book.name,
		full_title: `The book of ${book.name}`,
		abbreviation: book.usfm,
		canon: i < 39 ? 'old_testament' : 'new_testament',
		chapters: [
			{ id: 'intro', title: 'Introduction', verses: [] },
			...Array.from({ length: 50 }, (_, chapter) => ({
				id: String(chapter + 1),
				title: String(chapter + 1),
				verses: Array.from({ length: 50 }, (_, verse) => String(verse + 1)),
			})),
		],
	})),
};
const current = index.books.find((book) => book.id === 'PSA')!;
const locale = localeForCode('ru')!;
const render = (element: React.ReactElement) => renderToStaticMarkup(element);
const size = (value: unknown) => Buffer.byteLength(JSON.stringify(value));

test('book picker has identical HTML without chapter and verse payloads', () => {
	const projected = projectBookList(index);
	const before = render(
		React.createElement(BookList, { versionSlug: 'niv', books: index.books, locale }),
	);
	const after = render(
		React.createElement(BookList, { versionSlug: 'niv', books: projected.books, locale }),
	);
	assert.equal(after, before);
	assert.ok(size(projected) < size(index) * 0.05);
	assert.ok(projected.books.every((book) => !('chapters' in book)));
});

test('chapter grid preserves every chapter link while removing verse IDs', () => {
	const projected = projectChapterList(current);
	const before = render(
		React.createElement(ChapterGrid, { versionSlug: 'niv', book: current, locale }),
	);
	const after = render(
		React.createElement(ChapterGrid, { versionSlug: 'niv', book: projected, locale }),
	);
	assert.equal(after, before);
	assert.ok(size(projected) < size(current) * 0.1);
	assert.ok(projected.chapters.every((chapter) => !('verses' in chapter)));
	assert.ok(!projected.chapters.some((chapter) => chapter.id === 'intro'));
});

test('toolbar keeps book choices, selected chapter and slug collisions without unused indices', () => {
	const projected = projectReaderToolbar(index, current.id);
	const options = projectVersionOptions(catalog);
	const before = render(
		React.createElement(ReaderToolbar, {
			version: testVersion,
			catalog,
			index,
			bookId: current.id,
			chapterId: '28',
			locale,
		}),
	);
	const after = render(
		React.createElement(ReaderToolbar, {
			version: testVersion,
			catalog: options,
			index: projected,
			bookId: current.id,
			chapterId: '28',
			locale,
		}),
	);
	assert.equal(after, before);
	assert.match(after, /value="niv-111" selected=""/);
	assert.ok(size(projected) < size(index) * 0.1);
	assert.equal(projected.books.filter((book) => book.chapters).length, 1);
	assert.ok(
		projected.books
			.find((book) => book.id === current.id)
			?.chapters?.every((chapter) => !('verses' in chapter)),
	);
	assert.deepEqual(projectBookLabel(current), { id: current.id, title: current.title });
	// The active version itself is not projected: its publisher copyright still
	// travels with the Scripture. Only choices in the select are reduced.
	assert.equal(testVersion.copyright, 'Copyright Publisher');
	assert.ok(!('copyright' in options[0]!));
});
