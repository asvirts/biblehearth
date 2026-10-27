import type { ResourceHandler } from '../../lib/page/types';
import { LOCALES, localePath, splitLocalePath } from '../../lib/i18n/locales';
import {
	bookSlug,
	hasBook,
	localeBookNameForChapter,
	localizedBooks,
	usfmFromLocaleBookSlug,
	isCanonicalLocaleBookSlug,
} from '../../lib/bible/books';

/**
 * Round-trips every book slug in every locale, and reports what broke.
 *
 * Dev-only, and 404s in production — it is a check, not a page, and this project
 * has no test runner to put it in. Run the dev server and open
 * /api/i18n-smoke after regenerating the locale or book tables: a non-empty
 * `failures` array means a slug does not resolve back to its own book, which is
 * a 404 on a real URL rather than anything a build would catch.
 */
export const GET: ResourceHandler = ({ locals, url }) => {
	if (process.env.NODE_ENV !== 'development') {
		return new Response(null, { status: 404 });
	}

	const failures: string[] = [];
	const rows: unknown[] = [];

	/**
	 * What the middleware decided, echoed back.
	 *
	 * Reachable under any locale prefix, which is the whole test:
	 * `/pt/api/i18n-smoke` must report `pt` here while `url.pathname` reads
	 * `/api/i18n-smoke`, because the prefix is stripped before routing. If
	 * `resolved` comes back `en` on a prefixed request, the rewrite is not
	 * running and every localized URL on the site is quietly serving English.
	 */
	const middleware = {
		resolved: locals.locale?.code ?? '(unset — middleware did not run)',
		localePath: locals.localePath ?? null,
		routedPathname: url.pathname,
	};

	for (const locale of LOCALES) {
		const books = localizedBooks(locale);
		if (books.length === 0) {
			failures.push(`${locale.code}: empty book table`);
			continue;
		}

		// Every book must round-trip slug -> usfm -> slug, raw and percent-encoded.
		let roundTripped = 0;
		for (const book of books) {
			const back = usfmFromLocaleBookSlug(locale, book.slug);
			const encoded = usfmFromLocaleBookSlug(locale, encodeURIComponent(book.slug));
			const decomposed = usfmFromLocaleBookSlug(locale, book.slug.normalize('NFD'));
			if (back !== book.usfm) {
				failures.push(`${locale.code}: ${book.slug} -> ${back}, want ${book.usfm}`);
			} else if (encoded !== book.usfm) {
				failures.push(`${locale.code}: encoded ${book.slug} -> ${encoded}`);
			} else if (decomposed !== book.usfm) {
				failures.push(`${locale.code}: NFD ${book.slug} -> ${decomposed}`);
			} else {
				/**
				 * The canonical spelling — which is not always the table's.
				 *
				 * A SEARCH_SLUG override makes the publisher's slug an alias: it
				 * must still resolve (checked above) but it is no longer canonical,
				 * and asserting otherwise would fail on exactly the three locales
				 * the override exists for. What must hold is that the canonical
				 * spelling resolves to the same book and reports itself canonical,
				 * because that is the URL every link and every sitemap entry uses.
				 */
				const canonical = bookSlug(locale, book.usfm);
				if (usfmFromLocaleBookSlug(locale, canonical) !== book.usfm) {
					failures.push(`${locale.code}: canonical ${canonical} does not resolve to ${book.usfm}`);
				} else if (!isCanonicalLocaleBookSlug(locale, canonical, book.usfm)) {
					failures.push(`${locale.code}: ${canonical} is not canonical for ${book.usfm}`);
				} else {
					roundTripped += 1;
				}
			}
		}

		// A locale's own path must split back to that same locale.
		const probe = localePath(locale, `/${books[0]!.slug}/1`);
		const split = splitLocalePath(probe);
		if (split.locale.code !== locale.code) {
			failures.push(`${locale.code}: ${probe} split to ${split.locale.code}`);
		}

		const anchor = hasBook(locale, 'PSA') ? 'PSA' : 'JHN';
		rows.push({
			code: locale.code,
			dir: locale.dir,
			scope: locale.scope,
			books: books.length,
			roundTripped,
			versions: locale.versionIds?.length ?? 'all-minus-blocklist',
			samplePath: probe,
			chapterForm: hasBook(locale, anchor)
				? `${localeBookNameForChapter(locale, anchor)} 91`
				: null,
			psalmSlug: hasBook(locale, 'PSA') ? bookSlug(locale, 'PSA') : null,
		});
	}

	return new Response(
		JSON.stringify({ locales: LOCALES.length, middleware, failures, rows }, null, 1),
		{ headers: { 'Content-Type': 'application/json' } },
	);
};
