import PageLayout from '../../components/PageLayout';
import Passage from '../../components/Passage';
import CopyrightNotice from '../../components/CopyrightNotice';
import RelatedQuestions from '../../components/RelatedQuestions';
import StatusMessage from '../../components/StatusMessage';
import { bookStudyPath } from '../../lib/commentary/paths';
import { bookNameForChapter, bookNameFromUsfm } from '../../lib/bible/usfm';
import { absoluteUrl, chapterPath, versePath, versionPath } from '../../lib/bible/urls';
import { articleJsonLd, breadcrumbJsonLd, creativeWorkJsonLd, itemListJsonLd } from '../../lib/seo';
import { topicPath } from '../../lib/topics/paths';
import { displayAbbreviation } from '../../lib/bible/version-display';
import { chapterStudyPath } from '../../lib/commentary/paths';
import type { loadVerseHub } from '../../loaders/readers/verse-hub';

type Model = Awaited<ReturnType<typeof loadVerseHub>>;

export function renderVerseHub(model: Model) {
	const {
		brief,
		chapterId,
		verseId,
		bookUsfm,
		reference,
		renderings,
		status,
		canonicalPath,
		title,
		description,
		relatedTopics,
		relatedAnswers,
		previousLink,
		nextLink,
	} = model;
	const site = new URL(model.site);
	const explanation = brief ? (
		<article className="chapter-notes" aria-labelledby="verse-meaning">
			<h2 id="verse-meaning">{brief.title}</h2>
			<p className="lede">{brief.summary}</p>
			<div dangerouslySetInnerHTML={{ __html: brief.html }} />
			<p>
				<a href={chapterStudyPath(bookUsfm, chapterId)}>
					Read the full {bookNameForChapter(bookUsfm)} {chapterId} study
				</a>
			</p>
			<details>
				<summary>Sources and further reading</summary>
				<ul>
					{brief.sources.map((source) => (
						<li key={source.url}>
							<a href={source.url} rel="noopener noreferrer">
								{source.title}
							</a>
						</li>
					))}
				</ul>
			</details>
		</article>
	) : null;
	return (
		<PageLayout
			title={title}
			description={description}
			canonicalPath={canonicalPath}
			ogType={brief ? 'article' : 'website'}
			publishedTime={brief?.publishedAt}
			modifiedTime={brief?.reviewedAt}
			jsonLd={[
				breadcrumbJsonLd(site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: bookNameFromUsfm(bookUsfm), path: bookStudyPath(bookUsfm) },
					{ name: reference, path: canonicalPath },
				]),
				brief
					? articleJsonLd({
							site,
							path: canonicalPath,
							headline: brief.title,
							description,
							datePublished: brief.publishedAt,
							dateModified: brief.reviewedAt,
							citation: brief.sources.map(({ title, url }) => ({ name: title, url })),
						})
					: creativeWorkJsonLd({
							name: reference,
							description,
							inLanguage: 'en',
						}),
				itemListJsonLd({
					name: `${reference} in ${renderings.length} translations`,
					items: renderings.map((item) => ({
						name: `${reference} (${displayAbbreviation(item.version)})`,
						url: absoluteUrl(site, versePath(item.slug, bookUsfm, chapterId, verseId)),
					})),
				}),
			]}
		>
			<nav className="crumbs" aria-label="Breadcrumb">
				<a href="/">Home</a>
				<span>/</span>
				<a href={bookStudyPath(bookUsfm)}>{bookNameFromUsfm(bookUsfm)}</a>
				<span>/</span>
				<span>{reference}</span>
			</nav>

			<h1>{reference}</h1>

			{status !== 200 || renderings.length === 0 ? (
				<>
					<StatusMessage
						variant="notice"
						title="This verse is unavailable"
						message="Scripture could not be loaded right now. Please try again shortly."
					/>
					{explanation}
				</>
			) : (
				<>
					<p className="lede">
						{reference} in {renderings.length} English translations. Each links through to the full
						chapter for context.{' '}
						{brief ? <a href="#verse-meaning">Read the meaning and context</a> : null}
					</p>

					{renderings.map((item) => (
						<article key={item.version.id} className="verse-card">
							<h2>
								<a href={versePath(item.slug, bookUsfm, chapterId, verseId)}>
									{item.version.localized_title || item.version.title} (
									{displayAbbreviation(item.version)})
								</a>
							</h2>
							<Passage html={item.passage.content} />
							<p className="muted">
								<a href={chapterPath(item.slug, bookUsfm, chapterId)}>
									Read {bookNameForChapter(bookUsfm)} {chapterId} in{' '}
									{displayAbbreviation(item.version)}
								</a>
								{' · '}
								<a href={versionPath(item.slug)}>About the {displayAbbreviation(item.version)}</a>
							</p>
							<CopyrightNotice version={item.version} />
						</article>
					))}

					{explanation}

					<nav className="pager">
						{previousLink ? <a href={previousLink.href}>{previousLink.label}</a> : <span />}
						{nextLink ? <a href={nextLink.href}>{nextLink.label}</a> : <span />}
					</nav>

					<RelatedQuestions heading="Questions about this verse" answers={relatedAnswers} />

					{relatedTopics.length ? (
						<section className="chapter-topics">
							<h2>This verse appears in</h2>
							<ul className="topic-links">
								{relatedTopics.map((topic) => (
									<li key={topic.slug}>
										<a href={topicPath(topic.slug)}>
											Bible verses about {topic.title.toLowerCase()}
										</a>
									</li>
								))}
							</ul>
						</section>
					) : null}
				</>
			)}
		</PageLayout>
	);
}
