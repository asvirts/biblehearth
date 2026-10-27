import { strings } from '../../lib/i18n/strings';
import PageLayout from '../../components/PageLayout';
import StatusMessage from '../../components/StatusMessage';
import ExternalStudyLinks from '../../components/ExternalStudyLinks';
import { attributionLine } from '../../lib/commentary/sources';
import { chapterStudyPath, studyHubPath } from '../../lib/commentary/paths';
import { localePath } from '../../lib/i18n/locales';
import { breadcrumbJsonLd, creativeWorkJsonLd } from '../../lib/seo';
import type { loadStudyBook } from '../../loaders/readers/study-book';

type Model = Awaited<ReturnType<typeof loadStudyBook>>;

export function renderStudyBook(model: Model) {
	const {
		locale,
		bookSlug,
		bookUsfm,
		bookName,
		total,
		canonicalPath,
		overviews,
		chapters,
		briefedCount,
		indexable,
		externalLinks,
		title,
		description,
	} = model;
	const site = new URL(model.site);
	const t = strings(locale);
	return (
		<PageLayout
			title={title}
			description={description}
			canonicalPath={canonicalPath}
			noindex={!indexable}
			lang={locale.htmlLang}
			dir={locale.dir}
			jsonLd={[
				breadcrumbJsonLd(site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: 'Bible study', path: studyHubPath(locale) },
					{ name: bookName, path: canonicalPath },
				]),
				creativeWorkJsonLd({
					name: `${bookName} commentary`,
					description,
					inLanguage: locale.htmlLang,
				}),
			]}
		>
			<nav className="crumbs" aria-label="Breadcrumb">
				<a href={localePath(locale, '/')}>{t.home}</a>
				<span>/</span>
				<a href={studyHubPath(locale)}>{t.studyHub}</a>
				<span>/</span>
				<span>{bookName}</span>
			</nav>

			<h1>{bookName}</h1>

			<p className="lede">{t.book.lede(bookName, total, briefedCount)}</p>

			<section>
				<h2>{t.book.chaptersIn(bookName)}</h2>
				<div className="chapter-grid">
					{/* `briefed` is the whole reason this is an event rather than a
				   page view. An un-briefed chapter is `noindex`, so nobody
				   reaches it from search and its traffic says nothing about
				   demand — this click is the only signal there is for a chapter
				   nobody has written up yet, and it ranks the backlog by what
				   readers actually reach for. */}
					{/* A translated chapter exists only where somebody has written it; every
				   other one is a 404 (see `[chapter].astro`). Linking all 150 tiles of
				   `/es/salmo` therefore sent 149 of them to a dead end, so those are
				   plain numbers. In English every chapter has a page and stays a link. */}
					{chapters.map((chapter) =>
						locale.prefix && !chapter.brief ? (
							<span key={chapter.id} className="tile tile-unwritten">
								{chapter.label}
							</span>
						) : (
							<a
								key={chapter.id}
								className={chapter.brief ? 'tile tile-briefed' : 'tile'}
								href={chapterStudyPath(bookUsfm, chapter.id, locale)}
								title={chapter.brief?.data.title}
								data-va="chapter-tile"
								data-va-chapter={`${bookSlug}/${chapter.id}`}
								data-va-briefed={chapter.brief ? 'yes' : 'no'}
							>
								{chapter.label}
							</a>
						),
					)}
				</div>
				{briefedCount ? <p className="muted">{t.book.writtenNote}</p> : null}
			</section>

			{briefedCount ? (
				<section>
					<h2>{t.book.writtenIn(bookName)}</h2>
					<ul className="topic-links">
						{chapters
							.filter((chapter) => chapter.brief)
							.map((chapter) => (
								<li key={chapter.id}>
									<a href={chapterStudyPath(bookUsfm, chapter.id, locale)}>
										{chapter.brief?.data.title}
									</a>
								</li>
							))}
					</ul>
				</section>
			) : null}

			{overviews.length ? (
				<section className="book-overviews">
					<h2>What the book of {bookName} is about</h2>
					<p className="muted">
						Each commentary's own introduction to {bookName}, in full. Tyndale is the plainest read;
						the other two are older.
					</p>
					{overviews.map((overview) => (
						<section key={overview.source.id} className="commentary-source">
							<h3>{overview.source.name}</h3>
							<p className="source-byline">{overview.source.byline}</p>
							<details className="commentary-body">
								<summary>Read the introduction to {bookName}</summary>
								{overview.introduction.map((paragraph, index) => (
									<p key={index} dangerouslySetInnerHTML={{ __html: paragraph }} />
								))}
							</details>
							<p className="commentary-attribution">
								{attributionLine(overview.source)}{' '}
								<a
									href={overview.source.license.url}
									rel="license nofollow noopener"
									target="_blank"
								>
									{overview.source.license.name}
								</a>
							</p>
						</section>
					))}
				</section>
			) : locale.prefix ? null : (
				/* A translated book page has no introductions by design, so their absence
			   there is not an outage. The `notice` variant keeps the page to one
			   `<h1>` and drops the link home, which is advice to leave a page that
			   rendered. */
				<StatusMessage
					variant="notice"
					title="Book introductions are temporarily unavailable"
					message="The commentary introductions could not be loaded. The chapter pages above still work."
				/>
			)}

			<ExternalStudyLinks links={externalLinks} reference={bookName} />
		</PageLayout>
	);
}
