import type { APIRoute } from 'astro';
import { urlsetXmlWithLastmod, xmlResponse } from '../lib/sitemap';
import { CANON_ORDER } from '../lib/bible/chapters';
import {
	briefedChapters,
	commentaryBookPath,
	commentaryPath,
} from '../lib/commentary';

/**
 * Book pages and briefed chapters only.
 *
 * The other eleven hundred chapter pages are deliberately absent. They render
 * `noindex` because their substance is public-domain commentary that four larger
 * sites already publish verbatim, and listing a noindex URL in a sitemap is a
 * contradiction Search Console reports as an error. They stay crawlable through
 * the book pages, which is the right amount of discovery for them.
 *
 * A chapter earns its sitemap entry the moment someone writes it up.
 */
export const GET: APIRoute = async ({ site }) => {
	const briefed = await briefedChapters();

	return xmlResponse(
		urlsetXmlWithLastmod(site, [
			{ path: '/commentary' },
			{ path: '/attributions' },
			...CANON_ORDER.map((book) => ({ path: commentaryBookPath(book) })),
			...briefed.map((chapter) => {
				const [book, number] = chapter.usfm.split('.');
				return {
					path: commentaryPath(book ?? '', number ?? '1'),
					lastmod: chapter.reviewedAt,
				};
			}),
		]),
	);
};
