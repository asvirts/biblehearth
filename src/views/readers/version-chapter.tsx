import PageLayout from '../../components/PageLayout';
import CopyrightNotice from '../../components/CopyrightNotice';
import Passage from '../../components/Passage';
import ReaderToolbar from '../../components/ReaderToolbar';
import RelatedQuestions from '../../components/RelatedQuestions';
import StatusMessage from '../../components/StatusMessage';
import { chapterStudyPath } from '../../lib/commentary/paths';
import { topicPath } from '../../lib/topics/paths';
import { bookPath, chapterPath, versionPath } from '../../lib/bible/urls';
import { localePath } from '../../lib/i18n/locales';
import { breadcrumbJsonLd, creativeWorkJsonLd } from '../../lib/seo';
import { displayAbbreviation } from '../../lib/bible/version-display';
import type { loadVersionChapter } from '../../loaders/readers/version-chapter';

type Model = Awaited<ReturnType<typeof loadVersionChapter>>;

export function renderVersionChapter(model: Model) {
	const {
		locale,
		bookUsfm,
		chapterId,
		version,
		slug,
		index,
		book,
		catalog,
		passage,
		previousHref,
		nextHref,
		status,
		chapterTopics,
		chapterAnswers,
		chapterBrief,
		reference,
		displayNumber,
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
			canonicalPath={chapterPath(slug, bookUsfm, chapterId, locale)}
			prev={previousHref ?? undefined}
			next={nextHref ?? undefined}
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
									name: `Chapter ${displayNumber}`,
									path: chapterPath(slug, book.id, chapterId, locale),
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
			{status !== 200 || !version || !book || !index || !passage ? (
				<StatusMessage
					title="This chapter is unavailable"
					message="The requested chapter could not be loaded for this Bible version."
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
						<span>{displayNumber}</span>
					</nav>
					<h1>{heading}</h1>
					<ReaderToolbar
						catalog={catalog}
						version={version}
						index={index}
						bookId={book.id}
						chapterId={chapterId}
						locale={locale}
					/>
					<Passage html={passage.content} />
					<nav className="pager">
						{previousHref ? <a href={previousHref}>Previous chapter</a> : <span />}
						{nextHref ? <a href={nextHref}>Next chapter</a> : <span />}
					</nav>
					{!locale.prefix || chapterBrief ? (
						<section className="study-cta panel">
							<h2>Understand {reference}</h2>
							<p>
								{chapterBrief
									? `${chapterBrief.data.title}. The study includes an outline, definitions for unfamiliar words, and notes from three commentaries.`
									: `Walk through ${reference} verse by verse, then read what three commentaries say about the chapter. The explanations are written for new readers.`}
							</p>
							<a className="cta" href={chapterStudyPath(book.id, chapterId, locale)}>
								Read the {reference} commentary
							</a>
						</section>
					) : null}
					<RelatedQuestions heading="Questions about this chapter" answers={chapterAnswers} />
					{chapterTopics.length ? (
						<section className="chapter-topics">
							<h2>Topics in this chapter</h2>
							<ul className="topic-links">
								{chapterTopics.map((topic) => (
									<li key={topic.slug}>
										<a href={topicPath(topic.slug)}>
											Bible verses about {topic.title.toLowerCase()}
										</a>
									</li>
								))}
							</ul>
						</section>
					) : null}
					<CopyrightNotice version={version} />
				</>
			)}
		</PageLayout>
	);
}
