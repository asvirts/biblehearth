import { isNumericChapter, isNumericVerse } from './usfm';

export type VerseNavigationBook = {
	id: string;
	chapters: readonly {
		id: string;
		verses: readonly string[];
	}[];
};

export type VerseLocation = {
	bookId: string;
	chapterId: string;
	verseId: string;
};

/**
 * Find a neighboring verse from the publisher's index, never by guessing that
 * verse numbers are contiguous or that every chapter has a conventional end.
 *
 * If this edition omits or merges the requested verse in its index, return no
 * link. Its cached inventory is authoritative for navigation in that edition;
 * guessing from the URL could send a reader to another missing reference.
 */
export function adjacentVerse(
	books: readonly VerseNavigationBook[],
	location: VerseLocation,
	direction: 'next' | 'previous',
): VerseLocation | null {
	const step = direction === 'next' ? 1 : -1;
	const bookIndex = books.findIndex((book) => book.id === location.bookId);
	const book = books[bookIndex];
	const chapterIndex =
		book?.chapters.findIndex((chapter) => chapter.id === location.chapterId) ?? -1;
	const chapter = book?.chapters[chapterIndex];
	if (!book || !chapter) return null;

	const verseIndex = chapter.verses.indexOf(location.verseId);
	if (verseIndex < 0) return null;

	const adjacentInChapter = findVerseIndex(chapter.verses, verseIndex + step, step);
	if (adjacentInChapter !== null) {
		return {
			bookId: book.id,
			chapterId: chapter.id,
			verseId: chapter.verses[adjacentInChapter]!,
		};
	}

	let cursorBook = bookIndex;
	let cursorChapter = chapterIndex + step;
	while (cursorBook >= 0 && cursorBook < books.length) {
		const candidateBook = books[cursorBook]!;
		if (cursorChapter < 0 || cursorChapter >= candidateBook.chapters.length) {
			cursorBook += step;
			if (cursorBook < 0 || cursorBook >= books.length) break;
			cursorChapter = step > 0 ? 0 : books[cursorBook]!.chapters.length - 1;
			continue;
		}

		const candidateChapter = candidateBook.chapters[cursorChapter]!;
		if (isNumericChapter(candidateChapter.id)) {
			const verseIndex = findVerseIndex(
				candidateChapter.verses,
				step > 0 ? 0 : candidateChapter.verses.length - 1,
				step,
			);
			if (verseIndex !== null) {
				return {
					bookId: candidateBook.id,
					chapterId: candidateChapter.id,
					verseId: candidateChapter.verses[verseIndex]!,
				};
			}
		}
		cursorChapter += step;
	}

	return null;
}

function findVerseIndex(verses: readonly string[], start: number, step: number): number | null {
	for (let index = start; index >= 0 && index < verses.length; index += step) {
		if (isNumericVerse(verses[index]!)) return index;
	}
	return null;
}
