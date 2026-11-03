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
		hasChapterBrief,
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
			<h2 id="verse-meaning">Meaning and context</h2>
			<p className="lede">{brief.summary}</p>
			{status === 200 && renderings.length ? (
				<p>
					<a href="#translations">Compare translations</a>
				</p>
			) : null}
			<div dangerouslySetInnerHTML={{ __html: brief.html }} />
			<p>
				<a href={chapterStudyPath(bookUsfm, chapterId)}>
					{hasChapterBrief ? 'Read the full' : 'Read the'} {bookNameForChapter(bookUsfm)}{' '}
					{chapterId} {hasChapterBrief ? 'study' : 'commentary'}
				</a>
			</p>
			<section>
				<h3>Sources and further reading</h3>
				<ul>
					{brief.sources.map((source) => (
						<li key={source.url}>
							<a href={source.url} rel="noopener noreferrer">
								{source.title}
							</a>
						</li>
					))}
				</ul>
			</section>
			<footer className="topic-provenance">
				<p className="muted">
					By <a href="/about#who-runs-this">BibleHearth</a>. Reviewed{' '}
					{brief.reviewedAt.toLocaleDateString('en-US', {
						timeZone: 'UTC',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					})}
					.
				</p>
				<p className="muted">
					<a href="/about#editorial-process">How we prepare our guides</a>
					{' · '}
					<a href="/about#corrections">Report a correction</a>
				</p>
			</footer>
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

			<h1>{brief?.title ?? reference}</h1>
			{explanation}

			{status !== 200 || renderings.length === 0 ? (
				<>
					<StatusMessage
						variant="notice"
						title="This verse is unavailable"
						message="Scripture could not be loaded right now. Please try again shortly."
					/>
				</>
			) : (
				<>
					{brief ? <h2 id="translations">Compare translations</h2> : null}
					<p className="lede">
						{reference} in {renderings.length} English translations. Each links through to the full
						chapter for context.{' '}
					</p>

					{renderings.map((item) => (
						<article key={item.version.id} className="verse-card">
							{brief ? (
								<h3>
									<a href={versePath(item.slug, bookUsfm, chapterId, verseId)}>
										{item.version.localized_title || item.version.title} (
										{displayAbbreviation(item.version)})
									</a>
								</h3>
							) : (
								<h2>
									<a href={versePath(item.slug, bookUsfm, chapterId, verseId)}>
										{item.version.localized_title || item.version.title} (
										{displayAbbreviation(item.version)})
									</a>
								</h2>
							)}
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
