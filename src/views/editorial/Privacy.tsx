import type { ReactElement } from 'react';
import PageLayout from '../../components/PageLayout';
import { breadcrumbJsonLd, sitePageJsonLd } from '../../lib/seo';
import { ABOUT_PATH, CONTACT_PATH, EDITORIAL_EMAIL, PRIVACY_PATH } from '../../lib/site';
import type { loadPrivacy } from '../../loaders/editorial/Privacy';

export function Privacy(data: Awaited<ReturnType<typeof loadPrivacy>>): ReactElement {
	const { site, UPDATED, updatedLabel, title, description, processors } = data;
	const context = { site: new URL(site) };
	return (
		<PageLayout
			title={title}
			description={description}
			canonicalPath={PRIVACY_PATH}
			jsonLd={[
				breadcrumbJsonLd(context.site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: 'Privacy', path: PRIVACY_PATH },
				]),
				sitePageJsonLd({
					site: context.site,
					path: PRIVACY_PATH,
					type: 'WebPage',
					name: 'Privacy Policy',
					description,
					dateModified: UPDATED,
				}),
			]}
		>
			<nav className="crumbs" aria-label="Breadcrumb">
				<a href="/">Home</a>
				<span>/</span>
				<span>Privacy</span>
			</nav>

			<h1>Privacy Policy</h1>

			<p className="lede">
				BibleHearth has no accounts, advertising, or fields that ask for your name. The site does
				use four measurement tools, and its hosting service keeps ordinary server logs. This policy
				explains each service and the data it sees.
			</p>

			<p className="muted">Last updated {updatedLabel}.</p>

			<section>
				<h2>The short version</h2>
				<p>
					BibleHearth does not know your identity. The site does not sell visit data, build an
					advertising profile, or send information to an ad network. Its analytics show which pages
					are read, how visitors arrive, and their approximate location.
				</p>
				<p>
					A page address can still reveal which passage or sensitive topic someone is reading. The
					section below explains that in more detail.
				</p>
			</section>

			<section>
				<h2>What this site does not do</h2>
				<ul className="outline-list">
					<li>
						<p>There is no account, no login and no sign-up.</p>
					</li>
					<li>
						<p>There is no newsletter and no email is ever collected.</p>
					</li>
					<li>
						<p>
							There is no advertising, no ad network, and no tracking pixel from a social platform
							or an advertiser.
						</p>
					</li>
					<li>
						<p>
							Nothing about a visit is sold, rented, or shared for money, and nothing is used to
							target advertising anywhere else.
						</p>
					</li>
					<li>
						<p>
							This site sets no cookies of its own. It keeps no session, so it has nothing to keep
							one in.
						</p>
					</li>
					<li>
						<p>
							No page here has a comment box, a form that asks about you, or a field you can type
							into. The only form on the site is three dropdowns that pick a translation, a book and
							a chapter — so the only thing you can submit to this site is which passage you want to
							read.
						</p>
					</li>
				</ul>
			</section>

			<section>
				<h2>Who receives what</h2>
				<p>
					Four third parties see something about a visit. Each is named here with what it collects
					and what it stores in your browser.
				</p>
				{processors.map((processor) => (
					<div className="theme-item" key={processor.name}>
						<h3>{processor.name}</h3>
						<p className="source-byline">{processor.role}</p>
						<dl className="glossary-list">
							<div className="glossary-item">
								<dt>What it collects</dt>
								<dd>{processor.collects}</dd>
							</div>
							<div className="glossary-item">
								<dt>Cookies</dt>
								<dd>{processor.cookies}</dd>
							</div>
							<div className="glossary-item">
								<dt>Their policy</dt>
								<dd>
									<a href={processor.policy} rel="nofollow noopener" target="_blank">
										{processor.policyLabel}
									</a>
								</dd>
							</div>
						</dl>
					</div>
				))}
				<p className="muted">
					These are the only third parties currently receiving visit data. If the list becomes
					incomplete, please <a href={CONTACT_PATH}>tell us</a> so we can correct it.
				</p>
			</section>

			<section>
				<h2>Session recording, plainly</h2>
				<p>
					Microsoft Clarity can reconstruct how a page was used from pointer movement, clicks, and
					scrolling. It cannot see your camera, microphone, other tabs, or anything outside
					BibleHearth.
				</p>
				<p>
					The site has no account fields, search box, or other place to type personal information.
					Clarity therefore has no form entries to capture.
				</p>
			</section>

			<section>
				<h2>What your reading reveals</h2>
				<p>
					The passage you are reading appears in the page address, so a page view records that
					someone read Psalm 23, or a topic page about grief, or a question about the unforgivable
					sin. In several countries what a person reads about their faith is treated as a special
					category of information, and rightly.
				</p>
				<p>
					None of it is tied to a name, an account or an email, because this site has none of those
					to tie it to, and we make no attempt to work backwards from a visit to a person. But it is
					measured, by the four tools above, and a page about a hard subject is measured exactly
					like any other.
				</p>
				<p>
					Scripture is fetched by BibleHearth's server. Your browser never requests it directly from
					a translation publisher, so the publisher receives no visit data from you. The
					commentaries are also stored and served here.
				</p>
			</section>

			<section>
				<h2>How to stop it</h2>
				<p>
					A content blocker will stop all four scripts, and nothing on this site breaks when it
					does. The pages are rendered on the server and ship almost no JavaScript. With every
					analytics script blocked, you still get the text, the commentary, and the links. Nothing
					here detects a blocker, asks you to turn it off, or works less well because one is on.
				</p>
				<p>
					Private or incognito browsing discards the cookies at the end of the session, and clearing
					cookies for this site removes them. Google also publishes a{' '}
					<a
						href="https://tools.google.com/dlpage/gaoptout"
						rel="nofollow noopener"
						target="_blank"
					>
						browser add-on that opts out of Google Analytics
					</a>{' '}
					across every site that uses it.
				</p>
				<p>
					BibleHearth does not currently respond to Do Not Track or Global Privacy Control signals.
					A content blocker is the reliable way to prevent these analytics requests.
				</p>
			</section>

			<section>
				<h2>Email you send us</h2>
				<p>
					If you write to <a href={`mailto:${EDITORIAL_EMAIL}`}>{EDITORIAL_EMAIL}</a>, your message
					and address stay in that mailbox, and are used to answer you and to fix whatever you wrote
					about. They are not added to any list, because there is no list, and they are not passed
					to anyone else.
				</p>
			</section>

			<section>
				<h2>Children</h2>
				<p>
					This site is written for adults and older readers. It has no account, profile, or place to
					submit personal information, and it does not knowingly collect a child's details. If you
					believe something has been collected about a child, write to us and we will remove what we
					can.
				</p>
			</section>

			<section>
				<h2>Your rights and what we can do</h2>
				<p>
					Depending on where you live, you may have the right to ask what is held about you, to have
					it corrected or deleted, or to object to it being processed at all. Write to{' '}
					<a href={`mailto:${EDITORIAL_EMAIL}`}>{EDITORIAL_EMAIL}</a> and we will do what we can.
				</p>
				<p>
					Our ability to act is limited because analytics data is not tied to an identity. We cannot
					look you up because there is no record with your name on it to send you, correct or
					delete. For the aggregate measurement that does exist, the effective remedy is the one
					above: block the scripts, and nothing about your visits is measured at all. For anything
					held by Google, Microsoft, Ahrefs or Vercel about you across their own services, their
					policies above are where those requests are handled.
				</p>
			</section>

			<section>
				<h2>Changes to this page</h2>
				<p>
					When the list of tools above changes, this page changes with it and the date at the top
					moves. There is no archive of previous versions; if you want to know what it said before,
					ask.
				</p>
				<p className="muted">
					See also: <a href={ABOUT_PATH}>about this site</a>, and <a href={CONTACT_PATH}>contact</a>
					.
				</p>
			</section>
		</PageLayout>
	);
}
