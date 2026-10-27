import { chapterPath } from '../lib/bible/urls';
import { displayChapterNumber } from '../lib/bible/psalms';
import { DEFAULT_LOCALE, type Locale } from '../lib/i18n/locales';
import type { ChapterListBook } from '../loaders/readers/index-projection';
import { readableChapters } from '../lib/youversion/display';
type Props = {
	versionSlug: string;
	book: ChapterListBook;
	locale?: Locale;
};

export default function ChapterGrid(props: Props) {
	const { versionSlug, book, locale = DEFAULT_LOCALE } = props;
	const chapters = readableChapters(book);
	return (
		<>
			<div className="chapter-grid">
				{chapters.map((chapter) => (
					<a
						className="tile"
						key={chapter.id}
						href={chapterPath(versionSlug, book.id, chapter.id, locale)}
					>
						{book.id === 'PSA'
							? displayChapterNumber(locale, book.id, chapter.id)
							: chapter.title || chapter.id}
					</a>
				))}
			</div>
		</>
	);
}
