import type { ReactElement } from 'react';
import PageLayout from '../../components/PageLayout';
import Figure from '../../components/Figure';
import { STUDY_HUB_PATH, bookStudyPath, chapterStudyPath } from '../../lib/paths';
import { bookNameFromUsfm } from '../../lib/bible/usfm';
import { OLD_TESTAMENT_BOOKS, NEW_TESTAMENT_BOOKS, chapterCount } from '../../lib/bible/chapters';
import { absoluteUrl } from '../../lib/bible/urls';
import { breadcrumbJsonLd, itemListJsonLd } from '../../lib/seo';
import { COMMENTARY_SOURCES } from '../../lib/commentary/sources';
import type { loadStudy } from '../../loaders/editorial/Study';

export function Study(data: Awaited<ReturnType<typeof loadStudy>>): ReactElement {
	const { site, briefs, title, description, writtenSentence, books, figure, share } = data;
	const context = { site: new URL(site) };
	return (
		<PageLayout
			title={title}
			description={description}
			canonicalPath={STUDY_HUB_PATH}
			image={share?.image}
			imageAlt={share?.imageAlt}
			jsonLd={[
				breadcrumbJsonLd(context.site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: 'Bible study', path: STUDY_HUB_PATH },
				]),
				itemListJsonLd({
					name: 'Bible commentary by book',
					items: [...OLD_TESTAMENT_BOOKS, ...NEW_TESTAMENT_BOOKS].map((id) => ({
						name: bookNameFromUsfm(id),
						url: absoluteUrl(context.site, bookStudyPath(id)),
					})),
				}),
			]}
		>
			<nav className="crumbs" aria-label="Breadcrumb">
				<a href="/">Home</a>
				<span>/</span>
				<span>Bible study</span>
			</nav>

			<h1>Bible Commentary and Chapter Studies</h1>

			{/*
		The lede says which chapters have a study and which do not, because the
		page below is two things and a reader who does not know that will click a
		tile expecting the first and find the second. "Every chapter has a place
		here. Studies walk through the chapter in order" read as a promise of
		1,189 studies.
	*/}
			<p className="lede">
				Every chapter of the Bible is here, with notes from three free commentaries and no account
				or paywall. {writtenSentence} If you are new to the Bible, begin with the Tyndale notes;
				they use clear, modern English.
			</p>

			{figure ? <Figure figure={figure} /> : null}

			{briefs.length ? (
				<section>
					<h2>Chapters written up in full</h2>
					<p className="muted">
						These chapters include an original summary, an outline, a glossary, and answers to
						common questions.
					</p>
					<ul className="topic-links">
						{briefs.map((brief) => {
							const [book, chapter] = brief.usfm.split('.');
							return (
								<li key={brief.id}>
									<a href={chapterStudyPath(book ?? '', chapter ?? '1')}>{brief.title}</a>
								</li>
							);
						})}
					</ul>
				</section>
			) : null}

			{books.map((group) => (
				<section key={group.heading}>
					<h2>{group.heading}</h2>
					<div className="book-grid">
						{group.ids.map((id) => (
							<a className="tile" href={bookStudyPath(id)} key={id}>
								{bookNameFromUsfm(id)}
								<span className="tile-kicker">
									{chapterCount(id)} {chapterCount(id) === 1 ? 'chapter' : 'chapters'}
								</span>
							</a>
						))}
					</div>
				</section>
			))}

			<section>
				<h2>The commentaries on these pages</h2>
				<p className="muted">
					Listed in the order they appear on a chapter page, which is plainest first.
				</p>
				{COMMENTARY_SOURCES.map((source) => (
					<div className="theme-item" key={source.id}>
						<h3>{source.name}</h3>
						<p className="source-byline">
							{source.byline} · {source.license.name}
						</p>
						<p>{source.about}</p>
						{source.readingNote ? <p className="muted">{source.readingNote}</p> : null}
					</div>
				))}
				<p className="muted">
					Full license and attribution details are on the{' '}
					<a href="/attributions">attributions page</a>.
				</p>
			</section>
		</PageLayout>
	);
}
