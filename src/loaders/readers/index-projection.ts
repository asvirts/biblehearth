import type { BibleVersion } from '@youversion/platform-core';
import type { IndexedBible, IndexedBook, IndexedChapter } from '../../lib/youversion/api';
import { readableChapters } from '../../lib/youversion/display';

/** Values needed by the public book picker; chapter and verse indexes stay on the server. */
export type BookListItem = Pick<IndexedBook, 'id' | 'title' | 'abbreviation' | 'canon'>;
export type ChapterOption = Pick<IndexedChapter, 'id' | 'title'>;
export type ChapterListBook = Pick<IndexedBook, 'id' | 'title' | 'full_title'> & {
	chapters: readonly ChapterOption[];
};
export type ReaderToolbarBook = Pick<IndexedBook, 'id' | 'title'> & {
	chapters?: readonly ChapterOption[];
};
export type ReaderToolbarIndex = { books: readonly ReaderToolbarBook[] };
export type VersionOption = Pick<
	BibleVersion,
	'id' | 'abbreviation' | 'localized_abbreviation' | 'localized_title' | 'title'
>;

/** Project only after server-side existence and previous/next checks finish. */
export function projectBookList(index: IndexedBible): { books: BookListItem[] } {
	return {
		books: index.books.map(({ id, title, abbreviation, canon }) => ({
			id,
			title,
			abbreviation,
			canon,
		})),
	};
}

function chapterOptions(book: IndexedBook): ChapterOption[] {
	return readableChapters(book).map(({ id, title }) => ({ id, title }));
}

export function projectChapterList(book: IndexedBook): ChapterListBook {
	const { id, title, full_title } = book;
	return { id, title, full_title, chapters: chapterOptions(book) };
}

export function projectReaderToolbar(index: IndexedBible, bookId: string): ReaderToolbarIndex {
	return {
		books: index.books.map((book) =>
			book.id === bookId
				? { id: book.id, title: book.title, chapters: chapterOptions(book) }
				: { id: book.id, title: book.title },
		),
	};
}

export function projectBookLabel(book: IndexedBook): Pick<IndexedBook, 'id' | 'title'> {
	return { id: book.id, title: book.title };
}

/** Catalog choices need names and collision-safe slug inputs, not licence text. */
export function projectVersionOptions(catalog: readonly BibleVersion[]): VersionOption[] {
	return catalog.map(({ id, abbreviation, localized_abbreviation, localized_title, title }) => ({
		id,
		abbreviation,
		localized_abbreviation,
		localized_title,
		title,
	}));
}
