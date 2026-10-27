import type { ReactElement } from 'react';
import PageLayout from '../../components/PageLayout';
import { breadcrumbJsonLd } from '../../lib/seo';
import { licenseDisplayName } from '../../lib/images/types';
import { COMMENTARY_SOURCES } from '../../lib/commentary/sources';
import type { loadAttributions } from '../../loaders/editorial/Attributions';

export function Attributions(data: Awaited<ReturnType<typeof loadAttributions>>): ReactElement {
	const { site, figures, title, description } = data;
	const context = { site: new URL(site) };
	return (
		<PageLayout
			title={title}
			description={description}
			canonicalPath="/attributions"
			jsonLd={[
				breadcrumbJsonLd(context.site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: 'Attributions', path: '/attributions' },
				]),
			]}
		>
			<nav className="crumbs" aria-label="Breadcrumb">
				<a href="/">Home</a>
				<span>/</span>
				<span>Attributions</span>
			</nav>

			<h1>Attributions and Licenses</h1>

			<p className="lede">
				BibleHearth reproduces other people's work on its commentary pages. This page names each
				work, its license, and any formatting changes we made. When a work is not openly licensed,
				the site links to the original without copying it.
			</p>

			<section>
				<h2>Images</h2>
				{figures.length ? (
					<>
						<p>
							When an editorial page carries a picture, it is a public-domain painting or engraving
							for a named biblical scene, or a photograph or museum object otherwise. We host a
							copy. The work stays under its original license. Our writing is separate work and is
							not covered by it.
						</p>
						{figures.map((item) => {
							const licenseName = licenseDisplayName(
								item.figure.credit.license,
								item.figure.credit.licenseUrl,
							);
							return (
								<div
									className="theme-item"
									key={`${item.pagePath}:${item.figure.credit.sourceUrl}`}
								>
									<h3>{item.figure.credit.title}</h3>
									<dl className="glossary-list">
										<div className="glossary-item">
											<dt>Maker</dt>
											<dd>
												{item.figure.credit.creator}
												{item.figure.credit.date ? ` (${item.figure.credit.date})` : ''}
											</dd>
										</div>
										<div className="glossary-item">
											<dt>Holder</dt>
											<dd>{item.figure.credit.holder}</dd>
										</div>
										<div className="glossary-item">
											<dt>License</dt>
											<dd>
												<a
													href={item.figure.credit.licenseUrl}
													rel="license nofollow noopener"
													target="_blank"
												>
													{licenseName}
												</a>
											</dd>
										</div>
										<div className="glossary-item">
											<dt>Used on</dt>
											<dd>
												<a href={item.pagePath}>{item.pageName}</a>
											</dd>
										</div>
										<div className="glossary-item">
											<dt>Source</dt>
											<dd>
												<a
													href={item.figure.credit.sourceUrl}
													rel="nofollow noopener"
													target="_blank"
												>
													{item.figure.credit.sourceUrl}
												</a>
											</dd>
										</div>
									</dl>
									{item.figure.credit.license === 'cc-by-sa' ? (
										<p className="muted">
											This license is share-alike. The copy of this image on this site stays
											available under the same license. Our own writing on the page is separate work
											and is not covered by it.
										</p>
									) : null}
								</div>
							);
						})}
					</>
				) : (
					<p>
						There are no editorial pictures on the site at the moment. Pages that will carry one
						later will be listed here with the maker, holder, and license of each work.
					</p>
				)}
			</section>

			<section>
				<h2>Commentaries reproduced on this site</h2>
				{COMMENTARY_SOURCES.map((source) => (
					<div className="theme-item" key={source.id}>
						<h3>{source.name}</h3>
						<dl className="glossary-list">
							<div className="glossary-item">
								<dt>Author</dt>
								<dd>{source.byline}</dd>
							</div>
							<div className="glossary-item">
								<dt>License</dt>
								<dd>
									<a href={source.license.url} rel="license nofollow noopener" target="_blank">
										{source.license.name}
									</a>
									{source.license.holder ? ` — © ${source.license.holder}` : ''}
								</dd>
							</div>
							<div className="glossary-item">
								<dt>Changes we made</dt>
								<dd>
									Converted to web markup and split into paragraphs, and scripture references were
									turned into links. No wording was altered, abridged or added to.
								</dd>
							</div>
							<div className="glossary-item">
								<dt>Original</dt>
								<dd>
									<a href={source.homepage} rel="nofollow noopener" target="_blank">
										{source.homepage}
									</a>
								</dd>
							</div>
						</dl>
						{source.license.shareAlike ? (
							<p className="muted">
								This license is share-alike. The {source.name} text on this site, and any adaptation
								of it, stays available under the same license. Our own summaries, outlines and
								answers are separate work and are not covered by it.
							</p>
						) : null}
					</div>
				))}
			</section>

			<section>
				<h2>Commentaries we link to but do not reproduce</h2>
				<div className="theme-item">
					<h3>The Gospel Coalition Bible Commentary</h3>
					<p>
						The Gospel Coalition commentary is free to read but not openly licensed. Its terms
						permit unaltered excerpts with a backlink, but not full republication. Chapter pages
						therefore link to the relevant book.
					</p>
					<p className="muted">
						<a
							href="https://www.thegospelcoalition.org/commentary/"
							rel="nofollow noopener"
							target="_blank"
						>
							thegospelcoalition.org/commentary
						</a>
					</p>
				</div>
				<div className="theme-item">
					<h3>BibleProject</h3>
					<p>
						BibleProject's animated overviews introduce each biblical book. Its terms allow
						embedding and linking with attribution but prohibit derivative works, so chapter pages
						link to the relevant video.
					</p>
					<p className="muted">
						<a href="https://bibleproject.com/" rel="nofollow noopener" target="_blank">
							bibleproject.com
						</a>
					</p>
				</div>
			</section>

			<section>
				<h2>Scripture</h2>
				<p>
					Bible text is served from the YouVersion Platform under license from each translation's
					publisher. The required copyright notice for a translation appears on every page that
					shows its text. Scripture is never reproduced on this site outside those licensed
					surfaces.
				</p>
			</section>

			<section>
				<h2>Topical verse lists</h2>
				<p>
					Verse selections and explanations on the topic pages are our own, informed by Nave's
					Topical Bible (1897) and Torrey's New Topical Textbook (1897), both public domain.
				</p>
			</section>

			<section>
				<h2>Our own writing</h2>
				<p>
					Chapter summaries, outlines, glossaries, cautions and question answers are written by
					BibleHearth. Where they sit on the same page as a share-alike source they remain separate
					work: they are grounded in the commentaries but are not adaptations of them.
				</p>
			</section>
		</PageLayout>
	);
}
