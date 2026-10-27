import type { ReactElement } from 'react';
import PageLayout from '../../components/PageLayout';
import Figure from '../../components/Figure';
import { topicPath } from '../../lib/paths';
import { absoluteUrl } from '../../lib/bible/urls';
import { breadcrumbJsonLd, itemListJsonLd } from '../../lib/seo';
import type { loadTopicsIndex } from '../../loaders/editorial/TopicsIndex';

export function TopicsIndex(data: Awaited<ReturnType<typeof loadTopicsIndex>>): ReactElement {
	const { site, topics, names, figure, share } = data;
	const context = { site: new URL(site) };
	return (
		<PageLayout
			title={`Bible Topics | Verses About ${names} and More`}
			description={`Find Bible verses by topic, grouped by theme and explained in context. Browse ${topics.length} topics, including ${names.toLowerCase()}.`}
			canonicalPath="/topics"
			image={share?.image}
			imageAlt={share?.imageAlt}
			jsonLd={[
				breadcrumbJsonLd(context.site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: 'Topics', path: '/topics' },
				]),
				itemListJsonLd({
					name: 'Bible topics',
					items: topics.map((topic) => ({
						name: `Bible verses about ${topic.title.toLowerCase()}`,
						url: absoluteUrl(context.site, topicPath(topic.id)),
					})),
				}),
			]}
		>
			<nav className="crumbs" aria-label="Breadcrumb">
				<a href="/">Home</a>
				<span>/</span>
				<span>Topics</span>
			</nav>

			<h1>Bible Verses by Topic</h1>
			<p className="lede">
				Each topic brings related passages together by theme. A short note explains who is speaking,
				what is happening, and why the verse belongs in the list. Where a passage is often misused,
				the page explains the problem directly.
			</p>

			{figure ? <Figure figure={figure} /> : null}

			<div className="stack">
				{topics.map((topic) => (
					<article className="panel" key={topic.id}>
						<h2>
							<a href={topicPath(topic.id)}>Bible Verses About {topic.title}</a>
						</h2>
						{/* A one-line definition makes this hub itself answerable. */}
						<p>{topic.shortAnswer}</p>
						<p className="muted">
							{topic.verseCount} verses in {topic.groupCount} groups
							{topic.aliases.length ? ` · also: ${topic.aliases.slice(0, 3).join(', ')}` : ''}
						</p>
					</article>
				))}
			</div>
		</PageLayout>
	);
}
