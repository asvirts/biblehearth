import type { ReactElement } from 'react';
import PageLayout from '../../components/PageLayout';
import Figure from '../../components/Figure';
import Passage from '../../components/Passage';
import CopyrightNotice from '../../components/CopyrightNotice';
import StatusMessage from '../../components/StatusMessage';
import { answerPath } from '../../lib/paths';
import { versionPath } from '../../lib/bible/urls';
import { websiteJsonLd } from '../../lib/seo';
import type { loadHome } from '../../loaders/editorial/Home';

export function Home(data: Awaited<ReturnType<typeof loadHome>>): ReactElement {
	const {
		site,
		degraded,
		defaultVersion,
		votdPassage,
		startHref,
		versionLabel,
		votdHref,
		answers,
		featured,
		studies,
		description,
		figure,
		share,
	} = data;
	const context = { site: new URL(site) };
	return (
		<PageLayout
			title="BibleHearth | Read and Understand the Bible"
			description={description}
			canonicalPath="/"
			image={share?.image}
			imageAlt={share?.imageAlt}
			jsonLd={websiteJsonLd({ site: context.site, description })}
		>
			<div className="stack">
				<section>
					<p className="muted">Read Scripture at your own pace</p>
					<h1>Read the Bible with help when you need it</h1>
					<p className="lede">
						Choose from several English translations, then find clear studies for the passages and
						questions that often stop new readers.
					</p>
					{figure ? <Figure figure={figure} /> : null}
					<p>
						<a className="cta" href={startHref}>
							Start reading{versionLabel ? ` in ${versionLabel}` : ''}
						</a>
					</p>
				</section>

				{degraded ? (
					<StatusMessage
						variant="notice"
						title="Scripture is temporarily unavailable"
						message="The verse of the day could not be loaded. Studies and questions are still available."
					/>
				) : null}

				{votdPassage ? (
					<section className="panel">
						<p className="tile-kicker">
							<a href="/verse-of-the-day">Verse of the day</a>
						</p>
						<h2>{votdPassage.reference}</h2>
						<Passage html={votdPassage.content} />
						<p>
							<a href={votdHref}>Read this passage</a>
							{' · '}
							<a href="/verse-of-the-day">Today's verse in context</a>
						</p>
						{defaultVersion ? <CopyrightNotice version={defaultVersion} /> : null}
					</section>
				) : null}

				{studies.length > 0 ? (
					<section>
						<h2>Chapter studies</h2>
						<p className="lede">
							A walk through the chapter in order, in plain English, with the unfamiliar words
							explained.
						</p>
						<div className="version-grid">
							{studies.map((study) => (
								<a className="tile" href={study.href} key={study.href}>
									<span className="tile-kicker">Study</span>
									{study.title}
								</a>
							))}
						</div>
						<p>
							<a href="/study">All chapter studies</a>
						</p>
					</section>
				) : null}

				{answers.length > 0 ? (
					<section>
						<h2>Questions people ask</h2>
						<div className="version-grid">
							{answers.map((answer) => (
								<a className="tile" href={answerPath(answer.id)} key={answer.id}>
									<span className="tile-kicker">Answer</span>
									{answer.question}
								</a>
							))}
						</div>
						<p>
							<a href="/answers">All questions</a>
							{' · '}
							<a href="/topics">Bible verses by topic</a>
						</p>
					</section>
				) : null}

				{featured.length > 0 ? (
					<section>
						<h2>English versions</h2>
						<div className="version-grid">
							{featured.map((version) => (
								<a className="tile" href={versionPath(version.slug)} key={version.id}>
									<span className="tile-kicker">{version.abbreviation}</span>
									{version.title}
								</a>
							))}
						</div>
						<p>
							<a href="/versions">Browse all versions</a>
						</p>
					</section>
				) : null}
			</div>
		</PageLayout>
	);
}
