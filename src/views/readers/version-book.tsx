import PageLayout from '../../components/PageLayout';
import ChapterGrid from '../../components/ChapterGrid';
import CopyrightNotice from '../../components/CopyrightNotice';
import StatusMessage from '../../components/StatusMessage';
import { bookPath, versionPath } from '../../lib/bible/urls';
import { localePath } from '../../lib/i18n/locales';
import { breadcrumbJsonLd } from '../../lib/seo';
import { displayAbbreviation } from '../../lib/bible/version-display';
import type { loadVersionBook } from '../../loaders/readers/version-book';

type Model = Awaited<ReturnType<typeof loadVersionBook>>;

export function renderVersionBook(model: Model) {
	const { locale, bookUsfm, version, slug, book, status, bookTitle, versionLabel } = model;
	const site = new URL(model.site);
	return (
		<PageLayout
			title={
				status === 200
					? `${bookTitle} (${versionLabel}) · BibleHearth`
					: 'Book unavailable · BibleHearth'
			}
			description={
				status === 200
					? `Read ${bookTitle} in the ${version?.localized_title || version?.title} by chapter.`
					: 'This Bible book could not be loaded.'
			}
			lang={locale.htmlLang}
			dir={locale.dir}
			canonicalPath={bookPath(slug, bookUsfm, locale)}
			jsonLd={
				version && book
					? breadcrumbJsonLd(site, [
							{ name: 'BibleHearth', path: localePath(locale, '/') },
							{
								name: displayAbbreviation(version),
								path: versionPath(slug, locale),
							},
							{ name: book.title, path: bookPath(slug, book.id, locale) },
						])
					: undefined
			}
		>
			{status !== 200 || !version || !book ? (
				<StatusMessage
					title="This book is unavailable"
					message="The requested book could not be loaded for this Bible version."
				/>
			) : (
				<>
					<nav className="crumbs" aria-label="Breadcrumb">
						<a href={localePath(locale, '/')}>Home</a>
						<span>/</span>
						<a href={versionPath(slug, locale)}>{displayAbbreviation(version)}</a>
						<span>/</span>
						<span>{book.title}</span>
					</nav>
					<h1>
						{book.full_title || book.title}
						<span className="muted"> ({displayAbbreviation(version)})</span>
					</h1>
					<p className="lede">Select a chapter to read.</p>
					<ChapterGrid versionSlug={slug} book={book} locale={locale} />
					<CopyrightNotice version={version} />
				</>
			)}
		</PageLayout>
	);
}
