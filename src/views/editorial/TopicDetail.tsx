import type { ReactElement } from 'react';
import PageLayout from '../../components/PageLayout';
import Figure from '../../components/Figure';
import Passage from '../../components/Passage';
import CopyrightNotice from '../../components/CopyrightNotice';
import StatusMessage from '../../components/StatusMessage';
import { topicPath, topicVerses } from '../../lib/paths';
import { formatReference } from '../../lib/bible/refs';
import { bookSlugFromUsfm } from '../../lib/bible/usfm';
import { absoluteUrl, chapterPath } from '../../lib/bible/urls';
import { breadcrumbJsonLd, articleJsonLd, faqJsonLd, itemListJsonLd } from '../../lib/seo';
import { articleShareFields } from '../../lib/images/og';
import type { EditorialFigure } from '../../lib/images/types';
import type { loadTopicDetail } from '../../loaders/editorial/TopicDetail';

export function TopicDetail(data: Awaited<ReturnType<typeof loadTopicDetail>>): ReactElement {
	const {
		site,
		topic,
		version,
		readerSlug,
		passages,
		degraded,
		canonicalPath,
		title,
		headline,
		description,
		relatedTopics,
		relatedStudies,
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
	const reference = formatReference;
	return (
		<PageLayout
			title={title}
			description={description}
			canonicalPath={canonicalPath}
			markdown
			image={share?.image}
			imageAlt={share?.imageAlt}
			ogType="article"
			publishedTime={topic.data.publishedAt}
			modifiedTime={topic.data.reviewedAt}
			jsonLd={[
				breadcrumbJsonLd(context.site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: 'Topics', path: '/topics' },
					{ name: topic.data.title, path: canonicalPath },
				]),
				articleJsonLd({
					site: context.site,
					path: canonicalPath,
					headline,
					description,
					datePublished: topic.data.publishedAt,
					dateModified: topic.data.reviewedAt,
					about: topic.data.entity,
					...articleShareFields(share),
				}),
				itemListJsonLd({
					name: `Bible verses about ${topic.data.title.toLowerCase()}`,
					items: topicVerses(topic).map((verse) => ({
						name: reference(verse.usfm),
						url: absoluteUrl(context.site, readerHref(verse.usfm)),
					})),
				}),
				...(topic.data.faqs.length ? [faqJsonLd(topic.data.faqs)] : []),
			]}
		>
			<nav className="crumbs" aria-label="Breadcrumb">
				<a href="/">Home</a>
				<span>/</span>
				<a href="/topics">Topics</a>
				<span>/</span>
				<span>{topic.data.title}</span>
			</nav>

			<h1>{headline}</h1>

			{/* Answer-first: this is the chunk a snippet or retrieval model lifts whole. */}
			<p className="lede">{topic.data.shortAnswer}</p>

			{topic.data.figure ? <Figure figure={topic.data.figure as EditorialFigure} /> : null}

			{degraded ? (
				<StatusMessage
					variant="notice"
					title="Scripture is temporarily unavailable"
					message="The verses for this topic could not be loaded. The explanations below are still available."
				/>
			) : null}

			{topic.data.groups.map((group) => (
				<section className="topic-group" id={group.id} key={group.id}>
					<h2>{group.heading}</h2>
					<p className="muted">{group.rationale}</p>
					{group.verses.map((verse) => {
						const passage = passages.get(verse.usfm);
						return (
							<article className="verse-card" key={verse.usfm}>
								<h3>
									<a href={readerHref(verse.usfm)}>{reference(verse.usfm)}</a>
								</h3>
								{passage ? <Passage html={passage.content} /> : null}
								<p className="gloss">{verse.gloss}</p>
							</article>
						);
					})}
				</section>
			))}

			{topic.data.misuse ? (
				<section className="topic-misuse">
					<h2>Limits and common misreadings</h2>
					<p>{topic.data.misuse}</p>
				</section>
			) : null}

			<section className="topic-notes">
				<div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
			</section>

			{topic.data.faqs.length ? (
				<section className="topic-faq">
					<h2>Common questions about {topic.data.title.toLowerCase()}</h2>
					{topic.data.faqs.map((faq) => (
						<div className="faq-item" key={faq.q}>
							<h3>{faq.q}</h3>
							<p>{faq.a}</p>
						</div>
					))}
				</section>
			) : null}

			{relatedStudies.length ? (
				<section>
					<h2>Study these passages in context</h2>
					<p>Explore the setting and meaning of chapters cited above.</p>
					<div className="version-grid">
						{relatedStudies.map((study) => (
							<a className="tile" href={study.href} key={study.href}>
								<span className="tile-kicker">Chapter study</span>
								{study.title}
							</a>
						))}
					</div>
				</section>
			) : null}

			{relatedTopics.length ? (
				<section>
					<h2>Related topics</h2>
					<div className="version-grid">
						{relatedTopics.map((item) => (
							<a className="tile" href={topicPath(item.id)} key={item.id}>
								<span className="tile-kicker">Topic</span>
								{item.data.title}
							</a>
						))}
					</div>
				</section>
			) : null}

			<footer className="topic-provenance">
				<p className="muted">
					By <a href="/about#who-runs-this">BibleHearth</a>.
					<a href="/about#editorial-process">How we write and review our guides</a>.
				</p>
				<p className="muted">
					Verse selection and explanations reviewed {reviewed}. Sources consulted include Nave's
					Topical Bible (1897) and Torrey's New Topical Textbook (1897), both public domain.
				</p>
				{version ? <CopyrightNotice version={version} /> : null}
			</footer>
		</PageLayout>
	);
}
