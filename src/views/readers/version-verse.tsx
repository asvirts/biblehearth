import PageLayout from '../../components/PageLayout';
import CopyrightNotice from '../../components/CopyrightNotice';
import Passage from '../../components/Passage';
import StatusMessage from '../../components/StatusMessage';
import { bookSlugFromUsfm } from '../../lib/bible/usfm';
import { bookPath, chapterPath, versePath, versionPath } from '../../lib/bible/urls';
import { localePath } from '../../lib/i18n/locales';
import { breadcrumbJsonLd, creativeWorkJsonLd } from '../../lib/seo';
import { displayAbbreviation } from '../../lib/bible/version-display';
import type { loadVersionVerse } from '../../loaders/readers/version-verse';

type Model = Awaited<ReturnType<typeof loadVersionVerse>>;

export function renderVersionVerse(model: Model) {
	const {
		requestedChapter,
		verseId,
		locale,
		bookUsfm,
		chapterId,
		version,
		slug,
		book,
		passage,
		status,
		heading,
		title,
		description,
	} = model;
	const site = new URL(model.site);
	return (
		<PageLayout
			title={title}
			description={description}
			lang={locale.htmlLang}
			dir={locale.dir}
			canonicalPath={versePath(slug, bookUsfm, chapterId, verseId, locale)}
			noindex
			jsonLd={
				version && book
					? [
							breadcrumbJsonLd(site, [
								{ name: 'BibleHearth', path: localePath(locale, '/') },
								{
									name: displayAbbreviation(version),
									path: versionPath(slug, locale),
								},
								{
									name: book.title,
									path: bookPath(slug, book.id, locale),
								},
								{
									name: `Chapter ${requestedChapter}`,
									path: chapterPath(slug, book.id, chapterId, locale),
								},
								{
									name: `Verse ${verseId}`,
									path: versePath(slug, book.id, chapterId, verseId, locale),
								},
							]),
							creativeWorkJsonLd({
								name: heading,
								description,
								inLanguage: locale.htmlLang,
								copyrightNotice: version.copyright,
							}),
						]
					: undefined
			}
		>
			{status !== 200 || !version || !book || !passage ? (
				<StatusMessage
					title="This verse is unavailable"
					message="The requested verse could not be loaded for this Bible version."
				/>
			) : (
				<>
					<nav className="crumbs" aria-label="Breadcrumb">
						<a href={localePath(locale, '/')}>Home</a>
						<span>/</span>
						<a href={versionPath(slug, locale)}>{displayAbbreviation(version)}</a>
						<span>/</span>
						<a href={bookPath(slug, book.id, locale)}>{book.title}</a>
						<span>/</span>
						<a href={chapterPath(slug, book.id, chapterId, locale)}>{requestedChapter}</a>
						<span>/</span>
						<span>{verseId}</span>
					</nav>
					<h1>{heading}</h1>
					<p>
						<a href={chapterPath(slug, book.id, chapterId, locale)}>Read the full chapter</a>
						{' · '}
						<a href={`/verse/${bookSlugFromUsfm(bookUsfm)}/${chapterId}/${verseId}`}>
							Compare translations
						</a>
					</p>
					<Passage html={passage.content} />
					<CopyrightNotice version={version} />
				</>
			)}
		</PageLayout>
	);
}
