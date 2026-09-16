import type { APIRoute } from 'astro';
import { urlsetXmlWithLastmod, xmlResponse } from '../lib/sitemap';
import { CANON_ORDER } from '../lib/bible/chapters';
import { hasBook } from '../lib/bible/books';
import { LOCALES } from '../lib/i18n/locales';
import {
	briefedChapters,
	bookStudyPath,
	chapterStudyPath,
} from '../lib/commentary';

/**
 * Book pages and briefed chapters only, in every locale that has them.
 *
 * The other eleven hundred chapter pages are deliberately absent. They render
 * `noindex` because their substance is public-domain commentary that four larger
 * sites already publish verbatim, and listing a noindex URL in a sitemap is a
 * contradiction Search Console reports as an error. They stay crawlable through
 * the book pages, which is the right amount of discovery for them.
 *
 * A chapter earns its sitemap entry the moment someone writes it up — in the
 * language they wrote it in. A locale with no briefs contributes its book pages
 * and nothing else, so adding a language costs 66 URLs rather than 1,255 until
 * somebody actually writes for it.
 *
 * Book pages are filtered by `hasBook`, which is what keeps an Indonesian
 * Genesis out: that locale's only licensed version is a New Testament, so the
 * page 404s and a sitemap entry for it would be submitting a known 404.
 *
 * `/commentary` and `/attributions` belong to the section but are submitted by
 * sitemap-pages.xml, which is where every hand-written page lives. Listing them
 * here as well put two URLs in two sitemaps for no gain — it does not help them
 * get crawled, and it makes per-sitemap coverage in Search Console read as
 * though those pages belong to whichever report is being looked at.
 */
export const GET: APIRoute = async ({ request, site }) => {
	/**
	 * One pass per locale, awaited together.
	 *
	 * `briefedChapters` reads the already-loaded content collection rather than
	 * anything upstream, so 58 calls cost 58 filters over one array and no
	 * requests — which is why this can afford to ask per locale instead of
	 * grouping the briefs by hand.
	 */
	const perLocale = await Promise.all(
		LOCALES.map(async (locale) => ({
			locale,
			briefed: await briefedChapters(locale),
		})),
	);

	const entries = perLocale.flatMap(({ locale, briefed }) => {
		/**
		 * A locale with no briefs submits nothing at all — not even book pages.
		 *
		 * The English book pages earn their place on the licensed book overviews
		 * they carry, several thousand words of on-topic prose per book. Those
		 * overviews are English, and a translated book page therefore has neither
		 * them nor a brief: it is a heading and a grid of chapter numbers. Listing
		 * 66 of those per language would put 3,700 thin URLs in the sitemap of a
		 * site whose entire discipline is that a page earns indexation by having
		 * something of its own on it.
		 *
		 * So a language enters the sitemap when somebody writes for it, and the
		 * book pages come with the first brief. `hasBook` then keeps an Indonesian
		 * Genesis out, since that locale's only licensed version is a New
		 * Testament and the page 404s.
		 */
		if (briefed.length === 0) {
			return [];
		}

		/**
		 * Which books this locale has written in, and when each was last written
		 * in — the same test the book page itself uses to decide whether to be
		 * `noindex`.
		 *
		 * The keys must agree with that test exactly. Listing all 66 for a locale
		 * with one brief would submit 65 pages that render `noindex`, which is the
		 * contradiction this file's own header warns about. English is exempt: its
		 * book pages carry the licensed overviews, so all 66 are indexable and
		 * listed.
		 *
		 * The dates are what a book page can honestly claim. Its licensed overview
		 * does not change, but its chapter grid does — a tile becomes a briefed
		 * link the day somebody writes that chapter up — so the newest brief in
		 * the book is the last time the page itself differed. A book nobody has
		 * written in yet carries no date rather than a guess.
		 */
		const briefedBooks = new Map<string, Date>();
		for (const chapter of briefed) {
			const book = chapter.usfm.split('.')[0] ?? '';
			const current = briefedBooks.get(book);
			if (!current || chapter.reviewedAt > current) {
				briefedBooks.set(book, chapter.reviewedAt);
			}
		}

		const books = locale.prefix
			? CANON_ORDER.filter((book) => briefedBooks.has(book))
			: CANON_ORDER;

		return [
			...books
				.filter((book) => hasBook(locale, book))
				.map((book) => ({
					path: bookStudyPath(book, locale),
					lastmod: briefedBooks.get(book),
				})),
			...briefed.map((chapter) => {
				const [book, number] = chapter.usfm.split('.');
				return {
					path: chapterStudyPath(book ?? '', number ?? '1', locale),
					lastmod: chapter.reviewedAt,
				};
			}),
		];
	});

	return xmlResponse(urlsetXmlWithLastmod(site, entries), request);
};
