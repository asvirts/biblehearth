import type { PageContext } from '../../lib/page/types';
import { READER_CACHE_CONTROL, setCacheControl } from '../../lib/http';
import { breadcrumbJsonLd, sitePageJsonLd } from '../../lib/seo';
import {
	ABOUT_PATH,
	CONTACT_PATH,
	CORRECTIONS_ANCHOR,
	EDITORIAL_EMAIL,
	PRIVACY_PATH,
} from '../../lib/site';

export async function loadContact(context: PageContext) {
	setCacheControl(context.response, READER_CACHE_CONTROL);

	const title = 'Contact BibleHearth · Corrections and Permissions';
	const description =
		'Contact BibleHearth about corrections, broken pages, permissions, or questions about the writing.';

	const mailto = `mailto:${EDITORIAL_EMAIL}`;

	/*
	 * What the address is for, in the order a message is likely to be about.
	 *
	 * Routing stated on the page rather than split across several addresses: one
	 * inbox that is read beats four that look organised, and a contact page whose
	 * addresses go nowhere is the failure this page exists to avoid.
	 */
	const reasons = [
		{
			heading: 'A correction',
			body: 'A passage we have misread, a definition that is off, a claim that needs a source, or an attribution crediting the wrong person. The most useful message names the page and quotes the sentence.',
		},
		{
			heading: 'Something broken',
			body: 'A page that will not load, a link that has rotted, a chapter that renders wrong, or text that has gone missing. Send the address of the page and what you were doing when it happened.',
		},
		{
			heading: 'Licensing and permissions',
			body: 'If you publish a translation or a commentary that appears here and want it handled differently, this is the right address, and it is read as a priority. It is also where to ask about reusing our own writing.',
		},
		{
			heading: 'A question about the writing',
			body: 'Why a page says what it says, what it leaves out, or which sources sit behind it. If the answer changes the page, the page changes.',
		},
	] as const;

	return { site: context.site.toString(), title, description, mailto, reasons };
}
