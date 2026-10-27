import type { PageContext } from '../../lib/page/types';
import { READER_CACHE_CONTROL, setCacheControl } from '../../lib/http';
import { breadcrumbJsonLd, sitePageJsonLd } from '../../lib/seo';
import { ABOUT_PATH, CONTACT_PATH, EDITORIAL_EMAIL, PRIVACY_PATH } from '../../lib/site';

export async function loadPrivacy(context: PageContext) {
	setCacheControl(context.response, READER_CACHE_CONTROL);

	/*
	 * The date this policy last changed, kept by hand.
	 *
	 * A privacy policy is the one page on this site where a date is load-bearing:
	 * it is how a reader tells whether what they are reading still describes the
	 * site. It is not generated from the build, because a build date would move
	 * every deploy and quietly claim a review that never happened.
	 *
	 * Change it when the list of processors below changes — not otherwise.
	 */
	const UPDATED = new Date('2026-08-20T00:00:00Z');
	const updatedLabel = UPDATED.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC',
	});

	const title = 'Privacy Policy · What BibleHearth Measures';
	const description =
		'Learn what BibleHearth measures, which analytics services receive visit data, which cookies they set, and how to block them.';

	/*
	 * Every third party that receives anything about a visit, with what it does
	 * and whether it sets a cookie.
	 *
	 * Written out one by one rather than summarised as "we use analytics
	 * providers", which is the phrasing that lets a policy stay true while telling
	 * a reader nothing. If a script is added to BaseLayout and not added here,
	 * this page has become false — that is the point of the list.
	 */
	const processors = [
		{
			name: 'Vercel',
			role: 'Hosting, and Web Analytics',
			collects:
				'Every request to this site passes through Vercel, which serves the pages and keeps ordinary server logs. Its Web Analytics records the page, the referrer, approximate location from the request, and the browser, operating system and device type.',
			cookies:
				'None. Vercel uses a hash of the incoming request to identify a visit and discards it after 24 hours.',
			policy: 'https://vercel.com/legal/privacy-notice',
			policyLabel: 'vercel.com/legal/privacy-notice',
		},
		{
			name: 'Google Analytics 4',
			role: 'Traffic measurement',
			collects:
				'Page views, referrers, approximate location, and browser and device information, used to see which pages are read and how people arrive.',
			cookies:
				'Sets first-party cookies named _ga and _ga_ followed by a property identifier. By default, they can remain for up to two years, longer than any other cookie used on this site.',
			policy: 'https://policies.google.com/privacy',
			policyLabel: 'policies.google.com/privacy',
		},
		{
			name: 'Microsoft Clarity',
			role: 'Session replay and heatmaps',
			collects:
				'Records pointer movement, clicks, scrolling, and where a reader stopped. This shows whether people reach the end of a chapter study or leave partway through.',
			cookies:
				'Sets cookies named _clck and _clsk. Clarity applies its own consent mode by default to visitors in the European Economic Area, the United Kingdom, and Switzerland. It sets no cookie for those readers unless the site passes a consent signal; BibleHearth passes none.',
			policy: 'https://www.microsoft.com/en-us/privacy/privacystatement',
			policyLabel: 'Microsoft Privacy Statement',
		},
		{
			name: 'Ahrefs Web Analytics',
			role: 'Traffic measurement',
			collects:
				'Page views and referrers, used alongside the search data the same account reports on.',
			cookies: 'None, according to Ahrefs, which describes the script as cookie-free.',
			policy: 'https://ahrefs.com/legal/privacy-policy',
			policyLabel: 'ahrefs.com/legal/privacy-policy',
		},
	] as const;

	return { site: context.site.toString(), UPDATED, updatedLabel, title, description, processors };
}
