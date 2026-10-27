import type { ReactElement } from 'react';
import { Fragment } from 'react';
import PageLayout from '../../components/PageLayout';
import Figure from '../../components/Figure';
import Passage from '../../components/Passage';
import CopyrightNotice from '../../components/CopyrightNotice';
import StatusMessage from '../../components/StatusMessage';
import { answerPath, topicPath } from '../../lib/paths';
import { displayAbbreviation } from '../../lib/bible/version-display';
import { formatReference } from '../../lib/bible/refs';
import { bookSlugFromUsfm } from '../../lib/bible/usfm';
import { absoluteUrl, chapterPath } from '../../lib/bible/urls';
import { breadcrumbJsonLd, articleJsonLd, faqJsonLd, itemListJsonLd } from '../../lib/seo';
import { articleShareFields } from '../../lib/images/og';
import type { EditorialFigure } from '../../lib/images/types';
import type { loadAnswerDetail } from '../../loaders/editorial/AnswerDetail';

export function AnswerDetail(data: Awaited<ReturnType<typeof loadAnswerDetail>>): ReactElement {
	const {
		site,
		answer,
		anchor,
		views,
		version,
		readerSlug,
		passages,
		degraded,
		anchorReference,
		anchorChapterReference,
		anchorChapterHref,
		anchorVerses,
		canonicalPath,
		title,
		headline,
		description,
		citedRefs,
		relatedTopics,
		otherAnswers,
		reviewed,
		share,
		bodyHtml,
	} = data;
	const context = { site: new URL(site) };
	function readerHref(usfm: string): string {
		const [book, chapter, verse] = usfm.split('.');
		if (!book || !chapter) return '/versions';
		if (verse && !verse.includes('-'))
			return `/verse/${bookSlugFromUsfm(book)}/${chapter}/${verse}`;
		return readerSlug ? chapterPath(readerSlug, book, chapter) : '/versions';
	}
	return (
		<PageLayout
			title={title}
			description={description}
			canonicalPath={canonicalPath}
			markdown
			image={share?.image}
			imageAlt={share?.imageAlt}
			ogType="article"
			publishedTime={answer.data.publishedAt}
			modifiedTime={answer.data.reviewedAt}
			jsonLd={[
				breadcrumbJsonLd(context.site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: 'Answers', path: '/answers' },
					{ name: answer.data.label, path: canonicalPath },
				]),
				articleJsonLd({
					site: context.site,
					path: canonicalPath,
					headline,
					description,
					datePublished: answer.data.publishedAt,
					dateModified: answer.data.reviewedAt,
					about: answer.data.entity,
					...articleShareFields(share),
				}),
				itemListJsonLd({
					name: `Readings of ${anchorReference}`,
					items: views.map((view) => ({
						name: view.name,
						url: `${absoluteUrl(context.site, canonicalPath)}#${view.id}`,
					})),
				}),
				...(answer.data.faqs.length ? [faqJsonLd(answer.data.faqs)] : []),
			]}
		>
			<nav className="crumbs" aria-label="Breadcrumb">
				<a href="/">Home</a>
				<span>/</span>
				<a href="/answers">Answers</a>
				<span>/</span>
				<span>{answer.data.label}</span>
			</nav>

			<h1>{headline}</h1>

			{/* Answer-first: this is the chunk a snippet or retrieval model lifts whole. */}
			<p className="lede">{answer.data.shortAnswer}</p>

			{answer.data.figure ? <Figure figure={answer.data.figure as EditorialFigure} /> : null}

			{degraded ? (
				<StatusMessage
					variant="notice"
					title="Scripture is temporarily unavailable"
					message="The passages for this page could not be loaded. The explanations below are still available."
				/>
			) : null}

			<section className="answer-passage">
				<h2>The passage: {anchorReference}</h2>
				{passages.get(anchor.passage) ? (
					<Passage html={passages.get(anchor.passage)!.content} />
				) : null}
				<p className="muted">
					<a href={anchorChapterHref}>
						Read {anchorChapterReference}
						{version ? ` in ${displayAbbreviation(version)}` : ''}
					</a>
				</p>
				<p className="muted">
					Compare translations:{' '}
					{anchorVerses.map((usfm, i) => (
						<Fragment key={usfm}>
							{i > 0 ? ' · ' : ''}
							<a href={readerHref(usfm)}>{formatReference(usfm)}</a>
						</Fragment>
					))}
				</p>
			</section>

			<section className="answer-notes">
				<div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
			</section>

			<h2 id="views">The {views.length} main readings, compared</h2>

			{views.map((view) => (
				<section className="answer-view" id={view.id} key={view.id}>
					<h3>{view.name}</h3>
					<p className="answer-claim">{view.claim}</p>

					{view.verses.map((verse) => {
						const passage = passages.get(verse.usfm);
						return (
							<article className="verse-card" key={verse.usfm}>
								<h4>
									<a href={readerHref(verse.usfm)}>{formatReference(verse.usfm)}</a>
								</h4>
								{passage ? <Passage html={passage.content} /> : null}
								<p className="gloss">{verse.gloss}</p>
							</article>
						);
					})}

					<h4 className="answer-label">What supports it</h4>
					<p>{view.support}</p>

					<h4 className="answer-label">The strongest objection</h4>
					<p>{view.objection}</p>

					{view.held ? <p className="muted answer-held">Held by: {view.held}</p> : null}
				</section>
			))}

			{answer.data.bottomLine ? (
				<section className="answer-bottom-line">
					<h2>Where the evidence leaves it</h2>
					<p>{answer.data.bottomLine}</p>
				</section>
			) : null}

			{answer.data.caution.length ? (
				<section className="topic-misuse">
					<h2>Limits and common misreadings of {anchorReference}</h2>
					{answer.data.caution.map((paragraph, index) => (
						<p key={`${index}:${paragraph}`}>{paragraph}</p>
					))}
				</section>
			) : null}

			{answer.data.faqs.length ? (
				<section className="topic-faq">
					{/* No .toLowerCase() here: the label is a proper-noun phrase
				    ("Sons of God in Genesis 6"), not a common noun like a topic. */}
					<h2>Common questions about the {answer.data.label}</h2>
					{answer.data.faqs.map((faq) => (
						<div className="faq-item" key={faq.q}>
							<h3>{faq.q}</h3>
							<p>{faq.a}</p>
						</div>
					))}
				</section>
			) : null}

			<section className="answer-elsewhere">
				<h2>Every passage cited on this page</h2>
				<ul className="topic-links">
					{citedRefs.map((usfm, index) => (
						<li key={`${usfm}:${index}`}>
							<a href={readerHref(usfm)}>{formatReference(usfm)}</a>
						</li>
					))}
				</ul>
			</section>

			{relatedTopics.length || otherAnswers.length ? (
				<section>
					<h2>Keep reading</h2>
					<div className="version-grid">
						{otherAnswers.map((item) => (
							<a className="tile" href={answerPath(item.id)} key={item.id}>
								<span className="tile-kicker">Answer</span>
								{item.data.question}
							</a>
						))}
						{relatedTopics.map((item) => (
							<a className="tile" href={topicPath(item.id)} key={item.id}>
								<span className="tile-kicker">Topic</span>
								Bible verses about {item.data.title.toLowerCase()}
							</a>
						))}
					</div>
				</section>
			) : null}

			<footer className="topic-provenance">
				<p className="muted">
					Updated {reviewed}. Published by <a href="/about#who-runs-this">BibleHearth</a>. This page
					presents the main readings of a disputed passage, along with the evidence and objections
					attached to each one. It is written as a non-denominational explainer.
					<a href="/about#editorial-process">How our studies are prepared</a>.
				</p>
				{version ? <CopyrightNotice version={version} /> : null}
			</footer>
		</PageLayout>
	);
}
