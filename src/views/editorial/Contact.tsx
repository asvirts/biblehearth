import type { ReactElement } from 'react';
import PageLayout from '../../components/PageLayout';
import { breadcrumbJsonLd, sitePageJsonLd } from '../../lib/seo';
import {
	ABOUT_PATH,
	CONTACT_PATH,
	CORRECTIONS_ANCHOR,
	EDITORIAL_EMAIL,
	PRIVACY_PATH,
} from '../../lib/site';
import type { loadContact } from '../../loaders/editorial/Contact';

export function Contact(data: Awaited<ReturnType<typeof loadContact>>): ReactElement {
	const { site, title, description, mailto, reasons } = data;
	const context = { site: new URL(site) };
	return (
		<PageLayout
			title={title}
			description={description}
			canonicalPath={CONTACT_PATH}
			jsonLd={[
				breadcrumbJsonLd(context.site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: 'Contact', path: CONTACT_PATH },
				]),
				sitePageJsonLd({
					site: context.site,
					path: CONTACT_PATH,
					type: 'ContactPage',
					name: 'Contact BibleHearth',
					description,
				}),
			]}
		>
			<nav className="crumbs" aria-label="Breadcrumb">
				<a href="/">Home</a>
				<span>/</span>
				<span>Contact</span>
			</nav>

			<h1>Contact BibleHearth</h1>

			<p className="lede">
				Write to <a href={mailto}>{EDITORIAL_EMAIL}</a>. The same inbox handles corrections, broken
				pages, permissions, and questions about the studies.
			</p>

			<section>
				<h2>What to write about</h2>
				<dl className="glossary-list">
					{reasons.map((reason) => (
						<div className="glossary-item" key={reason.heading}>
							<dt>{reason.heading}</dt>
							<dd>{reason.body}</dd>
						</div>
					))}
				</dl>
				<p className="muted">
					What happens to a correction is set out on the{' '}
					<a href={`${ABOUT_PATH}#${CORRECTIONS_ANCHOR}`}>about page</a>: it is made on the page
					itself, the review date moves with it, and a page that was wrong in a way that changed its
					meaning says so.
				</p>
			</section>

			<section>
				<h2>What this address cannot do</h2>
				<p>
					This inbox cannot provide pastoral care. The studies can explain a passage, but personal
					questions about a marriage, a diagnosis, or grief need someone who knows you and the
					situation.
				</p>
				<p>
					If you are in crisis, contact a doctor or crisis line now. Email is too slow for an
					emergency, and trained local help can respond in ways this inbox cannot.
				</p>
				<p>
					If your question is about the Bible App, we cannot help: this site is not YouVersion, and
					messages about accounts, plans, streaks or the app itself never reach them. Their own
					support is at{' '}
					<a href="https://help.youversion.com" rel="nofollow noopener" target="_blank">
						help.youversion.com
					</a>
					.
				</p>
			</section>

			<section>
				<h2>What to expect</h2>
				<p>
					A person reads every message and usually replies within a few days. We may fix a reported
					error before sending a reply, but we try to do both.
				</p>
				<p>
					BibleHearth is a small site, and email is the only monitored contact channel. There is no
					telephone number or postal address.
				</p>
				<p className="muted">
					See also: <a href={ABOUT_PATH}>about this site</a> for who publishes it and how the
					writing is made, <a href="/attributions">attributions</a> for every source and license,
					and <a href={PRIVACY_PATH}>privacy</a> for what happens to an email you send and what the
					site measures.
				</p>
			</section>
		</PageLayout>
	);
}
