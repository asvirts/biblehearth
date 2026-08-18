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
 *
 * `/commentary` and `/attributions` belong to the section but are submitted by
 * sitemap-pages.xml, which is where every hand-written page lives. Listing them
 * here as well put two URLs in two sitemaps for no gain — it does not help them
 * get crawled, and it makes per-sitemap coverage in Search Console read as
 * though those pages belong to whichever report is being looked at.
 */
export const GET: APIRoute = async ({ site }) => {
	const briefed = await briefedChapters();

	return xmlResponse(
		urlsetXmlWithLastmod(site, [
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
