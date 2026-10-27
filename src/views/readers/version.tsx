import PageLayout from '../../components/PageLayout';
import BookList from '../../components/BookList';
import CopyrightNotice from '../../components/CopyrightNotice';
import StatusMessage from '../../components/StatusMessage';
import { truncateWords } from '../../lib/bible/text';
import { versionPath } from '../../lib/bible/urls';
import { localePath } from '../../lib/i18n/locales';
import { breadcrumbJsonLd } from '../../lib/seo';
import { displayAbbreviation } from '../../lib/bible/version-display';
import type { loadVersion } from '../../loaders/readers/version';

type Model = Awaited<ReturnType<typeof loadVersion>>;

export function renderVersion(model: Model) {
	const {
		locale,
		version,
		slug,
		index,
		status,
		edition,
		abbreviation,
		title,
		pageTitle,
		breadcrumbs,
	} = model;
	const site = new URL(model.site);
	return (
		<PageLayout
			title={status === 200 ? pageTitle : 'Bible version unavailable · BibleHearth'}
			description={
				status !== 200
					? 'This Bible version could not be loaded.'
					: edition
						? truncateWords(edition.summary)
						: `Read the ${title} by book and chapter, with publisher copyright displayed on every page.`
			}
			lang={locale.htmlLang}
			dir={locale.dir}
			canonicalPath={versionPath(slug, locale)}
			jsonLd={version ? breadcrumbJsonLd(site, breadcrumbs) : undefined}
		>
			{status !== 200 || !version || !index ? (
				<StatusMessage
					title="This version is unavailable"
					message="The Bible catalog or this translation could not be loaded right now."
				/>
			) : (
				<>
					<nav className="crumbs" aria-label="Breadcrumb">
						<a href={localePath(locale, '/')}>Home</a>
						{!locale.prefix ? (
							<>
								<span>/</span>
								<a href="/versions">Versions</a>
							</>
						) : null}
						<span>/</span>
						<span>{displayAbbreviation(version)}</span>
					</nav>
					<h1>{title}</h1>

					{edition ? (
						<>
							<p className="source-byline">{edition.byline}</p>
							<p className="lede">{edition.summary}</p>

							{edition.about.map((paragraph, index) => (
								<p key={index} className="source-about">
									{paragraph}
								</p>
							))}

							<dl className="glossary-list">
								<div className="glossary-item">
									<dt>How it translates</dt>
									<dd>{edition.approach}</dd>
								</div>
								<div className="glossary-item">
									<dt>Reading level</dt>
									<dd>{edition.readingLevel}</dd>
								</div>
								<div className="glossary-item">
									<dt>Best for</dt>
									<dd>{edition.bestFor}</dd>
								</div>
							</dl>

							<p className="source-reading-note">
								<strong>Worth knowing:</strong> {edition.caution}
							</p>

							{edition.compare.length > 0 ? (
								<section>
									<h2>Compare similar translations</h2>
									<dl className="glossary-list">
										{edition.compare.map((item) => (
											<div key={item.slug} className="glossary-item">
												<dt>
													<a href={versionPath(item.slug, locale)}>{item.label}</a>
												</dt>
												<dd>{item.note}</dd>
											</div>
										))}
									</dl>
								</section>
							) : null}

							<h2>Read the {abbreviation} by book</h2>
						</>
					) : (
						<p className="lede">Choose a book to start reading.</p>
					)}

					<BookList versionSlug={slug} books={index.books} locale={locale} />
					<CopyrightNotice version={version} />
				</>
			)}
		</PageLayout>
	);
}
