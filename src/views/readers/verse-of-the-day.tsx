import PageLayout from '../../components/PageLayout';
import Passage from '../../components/Passage';
import CopyrightNotice from '../../components/CopyrightNotice';
import RelatedQuestions from '../../components/RelatedQuestions';
import StatusMessage from '../../components/StatusMessage';
import { bookNameForChapter } from '../../lib/bible/usfm';
import { versionPath } from '../../lib/bible/urls';
import { articleJsonLd, breadcrumbJsonLd, creativeWorkJsonLd } from '../../lib/seo';
import { topicPath } from '../../lib/topics/paths';
import type { loadVerseOfTheDay } from '../../loaders/readers/verse-of-the-day';

type Model = Awaited<ReturnType<typeof loadVerseOfTheDay>>;

export function renderVerseOfTheDay(model: Model) {
	const {
		CANONICAL_PATH,
		status,
		errorTitle,
		errorMessage,
		version,
		passage,
		slug,
		bookUsfm,
		chapterId,
		abbreviation,
		reference,
		chapterHref,
		verseHref,
		compareHref,
		relatedTopics,
		relatedAnswers,
		dayStart,
		dateLabel,
		title,
		description,
	} = model;
	const site = new URL(model.site);
	return (
		<PageLayout
			title={title}
			description={description}
			canonicalPath={CANONICAL_PATH}
			jsonLd={[
				breadcrumbJsonLd(site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: 'Verse of the Day', path: CANONICAL_PATH },
				]),
				articleJsonLd({
					site: site,
					path: CANONICAL_PATH,
					// Now the same string as the <title>, and kept that way on purpose.
					headline: title,
					description,
					datePublished: dayStart,
					dateModified: dayStart,
					about: { name: 'Bible verse of the day' },
				}),
				...(reference
					? [
							creativeWorkJsonLd({
								name: reference,
								description,
								inLanguage: 'en',
								copyrightNotice: version?.copyright ?? null,
							}),
						]
					: []),
			]}
		>
			<nav className="crumbs" aria-label="Breadcrumb">
				<a href="/">Home</a>
				<span>/</span>
				<span>Verse of the Day</span>
			</nav>

			<h1>Bible Verse of the Day</h1>

			{status !== 200 || !passage ? (
				<StatusMessage
					variant="notice"
					title={errorTitle || 'The verse of the day is unavailable'}
					message={
						errorMessage || 'Scripture could not be loaded right now. Please try again shortly.'
					}
				/>
			) : (
				<>
					<p className="lede">
						A new passage every day, drawn from the YouVersion Verse of the Day calendar. Today is{' '}
						<time dateTime={dayStart.toISOString().slice(0, 10)}>{dateLabel}</time>.
					</p>

					<section className="panel">
						<h2>
							{reference}
							{abbreviation ? <span className="muted"> · {abbreviation}</span> : null}
						</h2>
						<Passage html={passage.content} />

						<p>
							{chapterHref ? (
								<a href={chapterHref}>
									Read {bookUsfm ? bookNameForChapter(bookUsfm) : 'the'} {chapterId} in full
								</a>
							) : null}
							{chapterHref && compareHref ? ' · ' : null}
							{compareHref ? (
								<a href={compareHref}>Compare {reference} across translations</a>
							) : null}
						</p>

						{version ? <CopyrightNotice version={version} /> : null}
					</section>

					<RelatedQuestions heading="Questions about this verse" answers={relatedAnswers} />

					{relatedTopics.length ? (
						<section>
							<h2>Topics this verse speaks to</h2>
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

					<section>
						<h2>Keep reading</h2>
						<p>
							The verse above is shown in the{' '}
							{version ? (
								<a href={versionPath(slug)}>{version.localized_title || version.title}</a>
							) : (
								'default translation'
							)}
							. You can read the same passage in any licensed English translation, or start
							somewhere new.
						</p>
						<p>
							<a href="/topics">Browse verses by topic</a>
							{' · '}
							<a href="/versions">Browse all translations</a>
							{verseHref ? (
								<>
									{' · '}
									<a href={verseHref}>
										{reference} in {abbreviation}
									</a>
								</>
							) : null}
						</p>
					</section>
				</>
			)}
		</PageLayout>
	);
}
