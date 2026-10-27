import PageLayout from '../../components/PageLayout';
import Passage from '../../components/Passage';
import CopyrightNotice from '../../components/CopyrightNotice';
import RelatedQuestions from '../../components/RelatedQuestions';
import StatusMessage from '../../components/StatusMessage';
import { bookStudyPath } from '../../lib/commentary/paths';
import { bookNameForChapter, bookNameFromUsfm } from '../../lib/bible/usfm';
import { absoluteUrl, chapterPath, versePath, versionPath } from '../../lib/bible/urls';
import { breadcrumbJsonLd, creativeWorkJsonLd, itemListJsonLd } from '../../lib/seo';
import { topicPath } from '../../lib/topics/paths';
import { displayAbbreviation } from '../../lib/bible/version-display';
import type { loadVerseHub } from '../../loaders/readers/verse-hub';

type Model = Awaited<ReturnType<typeof loadVerseHub>>;

export function renderVerseHub(model: Model) {
	const {
		bookSlug,
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
		previousVerse,
		nextVerse,
	} = model;
	const site = new URL(model.site);
	return (
		<PageLayout
			title={title}
			description={description}
			canonicalPath={canonicalPath}
			jsonLd={[
				breadcrumbJsonLd(site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: bookNameFromUsfm(bookUsfm), path: bookStudyPath(bookUsfm) },
					{ name: reference, path: canonicalPath },
				]),
				creativeWorkJsonLd({
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
				<StatusMessage
					variant="notice"
					title="This verse is unavailable"
					message="Scripture could not be loaded right now. Please try again shortly."
				/>
			) : (
				<>
					<p className="lede">
						{reference} in {renderings.length} English translations. Each links through to the full
						chapter for context.
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

					<nav className="pager">
						{previousVerse ? (
							<a href={`/verse/${bookSlug}/${chapterId}/${previousVerse}`}>
								{reference.replace(/:\d+$/, `:${previousVerse}`)}
							</a>
						) : (
							<span />
						)}
						<a href={`/verse/${bookSlug}/${chapterId}/${nextVerse}`}>
							{reference.replace(/:\d+$/, `:${nextVerse}`)}
						</a>
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
