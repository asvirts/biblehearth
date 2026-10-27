import { bookPath } from '../lib/bible/urls';
import { DEFAULT_LOCALE, type Locale } from '../lib/i18n/locales';
import type { BookListItem } from '../loaders/readers/index-projection';
type Props = {
	versionSlug: string;
	books: readonly BookListItem[];
	locale?: Locale;
};

export default function BookList(props: Props) {
	const { versionSlug, books, locale = DEFAULT_LOCALE } = props;

	const groups = [
		{ id: 'old_testament', label: 'Old Testament' },
		{ id: 'new_testament', label: 'New Testament' },
		{ id: 'deuterocanon', label: 'Deuterocanon' },
	] as const;
	return (
		<>
			{groups.map((group) => {
				const items = books.filter((book) => book.canon === group.id);
				if (items.length === 0) {
					return null;
				}

				return (
					<section key={group.id}>
						<h2 className="canon-label">{group.label}</h2>
						<div className="book-grid">
							{items.map((book) => (
								<a className="tile" key={book.id} href={bookPath(versionSlug, book.id, locale)}>
									<span className="tile-kicker">{book.abbreviation}</span>
									{book.title}
								</a>
							))}
						</div>
					</section>
				);
			})}
		</>
	);
}
