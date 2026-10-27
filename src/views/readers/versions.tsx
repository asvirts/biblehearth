import PageLayout from '../../components/PageLayout';
import StatusMessage from '../../components/StatusMessage';
import { absoluteUrl } from '../../lib/bible/urls';
import { breadcrumbJsonLd, itemListJsonLd } from '../../lib/seo';
import type { loadVersions } from '../../loaders/readers/versions';

type Model = Awaited<ReturnType<typeof loadVersions>>;

export function renderVersions(model: Model) {
	const { status, errorTitle, errorMessage, listed } = model;
	const site = new URL(model.site);
	return (
		<PageLayout
			title="Compare Bible Translations | Which One Should You Read?"
			description="Every English Bible translation on BibleHearth, compared: how literal each one is, how easy it is to read, and which to choose when you are starting out."
			canonicalPath="/versions"
			jsonLd={[
				breadcrumbJsonLd(site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: 'Versions', path: '/versions' },
				]),
				itemListJsonLd({
					name: 'English Bible translations on BibleHearth',
					items: listed.map((item) => ({
						name: item.name,
						url: absoluteUrl(site, item.path),
					})),
				}),
			]}
		>
			{status !== 200 ? (
				<StatusMessage title={errorTitle} message={errorMessage} />
			) : (
				<div className="stack">
					<section>
						<nav className="crumbs" aria-label="Breadcrumb">
							<a href="/">Home</a>
							<span>/</span>
							<span>Versions</span>
						</nav>
						<h1>Which Bible translation should you read?</h1>
						<p className="lede">
							Every translation here was produced from the Hebrew and Greek by a team of scholars.
							They tell the same story, but they make different choices about wording and
							readability. Those choices can help you find a Bible that fits the way you read.
						</p>
					</section>

					<section>
						<h2>The main difference between translations</h2>
						<p>
							Translators decide how closely to follow the original wording and how naturally the
							result should read in English. Staying close to the wording lets you see more of the
							original structure, though the English may feel stiff. Smoother translations are
							easier to follow, but some of the translators' decisions become less visible.
						</p>
						<p>
							No translation does only one of these. Each one sits at a different point between
							them, and that is what the labels below are describing. “Formal” means it stays close
							to the wording. “Balanced” means it moves between the two. “Simplified” means it has
							been restated in the shortest sentences that will carry the meaning.
						</p>
					</section>

					<section>
						<h2>Accuracy and reading level</h2>
						<p>
							Every translation on this page is a serious translation. Their teams sometimes make
							different judgments when the original wording allows more than one clear English
							rendering.
						</p>
						<p>
							Reading level tells you how long the sentences are and how familiar the vocabulary is.
							A third-grade reading level uses shorter sentences; it is not a lesser Bible. Many
							adults find that a simpler translation helps them read whole books without losing the
							thread.
						</p>
					</section>

					<section>
						<h2>How to choose</h2>
						<p>
							If you have not read much of the Bible, try the NIV. Choose the NIrV if you prefer
							even shorter sentences. A formal translation can help when you want to study how a
							sentence is built. The Amplified is most useful when you are slowing down over a
							single verse.
						</p>
						<p>
							And read more than one. The cheapest way to find out whether a verse means what you
							think it means is to read it in a translation that words it differently.
						</p>
					</section>

					<section>
						<h2>The translations</h2>
						<div className="version-grid">
							{listed.map((item) => (
								<a key={item.slug} className="tile" href={item.path}>
									<span className="tile-kicker">{item.abbr}</span>
									{item.name}
									{item.style || item.grade ? (
										<span className="muted">
											{' '}
											· {[item.style, item.grade].filter(Boolean).join(' · ')}
										</span>
									) : null}
								</a>
							))}
						</div>
						<p>
							Each translation has its own page with its history, approach, reading level, best
							uses, and limitations.
						</p>
					</section>
				</div>
			)}
		</PageLayout>
	);
}
