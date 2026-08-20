import type { APIRoute } from 'astro';
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
export const GET: APIRoute = () => {
	if (!import.meta.env.DEV) {
		return new Response(null, { status: 404 });
	}

	const failures: string[] = [];
	const rows: unknown[] = [];

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
			const encoded = usfmFromLocaleBookSlug(
				locale,
				encodeURIComponent(book.slug),
			);
			const decomposed = usfmFromLocaleBookSlug(
				locale,
				book.slug.normalize('NFD'),
			);
			if (back !== book.usfm) {
				failures.push(`${locale.code}: ${book.slug} -> ${back}, want ${book.usfm}`);
			} else if (encoded !== book.usfm) {
				failures.push(`${locale.code}: encoded ${book.slug} -> ${encoded}`);
			} else if (decomposed !== book.usfm) {
				failures.push(`${locale.code}: NFD ${book.slug} -> ${decomposed}`);
			} else if (!isCanonicalLocaleBookSlug(locale, book.slug, book.usfm)) {
				failures.push(`${locale.code}: ${book.slug} is not canonical for ${book.usfm}`);
			} else {
				roundTripped += 1;
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
		JSON.stringify(
			{ locales: LOCALES.length, failures, rows },
			null,
			1,
		),
		{ headers: { 'Content-Type': 'application/json' } },
	);
};
