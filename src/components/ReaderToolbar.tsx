import type { BibleVersion } from '@youversion/platform-core';
import { bookSlug } from '../lib/bible/books';
import { displayChapterNumber } from '../lib/bible/psalms';
import { DEFAULT_LOCALE, localePath, type Locale } from '../lib/i18n/locales';
import type { ReaderToolbarIndex, VersionOption } from '../loaders/readers/index-projection';
import { displayAbbreviation, readableChapters, versionSlug } from '../lib/youversion/display';
type Props = {
	catalog: readonly VersionOption[];
	version: BibleVersion;
	index: ReaderToolbarIndex;
	bookId: string;
	chapterId: string;
	locale?: Locale;
};

export default function ReaderToolbar(props: Props) {
	const { catalog, version, index, bookId, chapterId, locale = DEFAULT_LOCALE } = props;
	const currentSlug = versionSlug(version, catalog);
	const currentBook = index.books.find((book) => book.id === bookId);
	const chapters = currentBook ? readableChapters(currentBook) : [];
	return (
		<>
			<form className="toolbar" method="get" action={localePath(locale, '/read')}>
				<label className="field-wide">
					Version
					<select name="version" defaultValue={currentSlug}>
						{catalog.map((item) => {
							const slug = versionSlug(item, catalog);
							return (
								<option key={item.id} value={slug}>
									{displayAbbreviation(item)} — {item.localized_title || item.title}
								</option>
							);
						})}
					</select>
				</label>
				<label>
					Book
					<select name="book" defaultValue={bookSlug(locale, bookId)}>
						{index.books.map((book) => (
							<option key={book.id} value={bookSlug(locale, book.id)}>
								{book.title}
							</option>
						))}
					</select>
				</label>
				<label>
					Chapter
					<select name="chapter" defaultValue={displayChapterNumber(locale, bookId, chapterId)}>
						{chapters.map((chapter) => (
							<option key={chapter.id} value={displayChapterNumber(locale, bookId, chapter.id)}>
								{bookId === 'PSA'
									? displayChapterNumber(locale, bookId, chapter.id)
									: chapter.title || chapter.id}
							</option>
						))}
					</select>
				</label>
				<button type="submit">Go</button>
			</form>
		</>
	);
}
