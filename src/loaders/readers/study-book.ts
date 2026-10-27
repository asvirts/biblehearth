import { attributionLine } from '../../lib/commentary/sources';
import { chapterCount, isCanonicalBook } from '../../lib/bible/chapters';
import {
	bookName as localeBookName,
	hasBook,
	isCanonicalLocaleBookSlug,
	usfmFromLocaleBookSlug,
} from '../../lib/bible/books';
import { displayChapterNumber } from '../../lib/bible/psalms';
import { encodedPath } from '../../lib/bible/urls';
import {
	bookStudyPath,
	chapterBriefIndex,
	chapterStudyPath,
	externalStudyLinks,
	loadBookOverviews,
	studyHubPath,
	type BookOverview,
} from '../../lib/commentary';
import { READER_CACHE_CONTROL, setCacheControl } from '../../lib/http';
import { localePath } from '../../lib/i18n/locales';
import { strings } from '../../lib/i18n/strings';
import { breadcrumbJsonLd, creativeWorkJsonLd } from '../../lib/seo';
import type { PageContext } from '../../lib/page/types';

/** Loads the StudyBook view once on the server. */
export async function loadStudyBook(context: PageContext) {
	/** Decided by middleware; see src/middleware.ts. */
	const locale = context.locals.locale;
	/** Headings and copy in this locale; see lib/i18n/strings.ts. */
	const t = strings(locale);

	const bookSlug = context.params.book;
	if (!bookSlug) {
		return context.notFound();
	}

	const bookUsfm = usfmFromLocaleBookSlug(locale, bookSlug);
	// `hasBook` is the New Testament check: a locale whose only licensed version
	// stops at Revelation does not have Genesis, and a book page listing fifty
	// chapters with no text behind any of them is worse than a 404.
	if (!bookUsfm || !isCanonicalBook(bookUsfm) || !hasBook(locale, bookUsfm)) {
		return context.notFound();
	}

	// See isCanonicalLocaleBookSlug: `/psa` is the same book as `/psalms`, and only
	// one of the two is the page.
	if (!isCanonicalLocaleBookSlug(locale, bookSlug, bookUsfm)) {
		return context.redirect(encodedPath(bookStudyPath(bookUsfm, locale)), 301);
	}

	const bookName = localeBookName(locale, bookUsfm);
	const total = chapterCount(bookUsfm);
	const canonicalPath = bookStudyPath(bookUsfm, locale);

	/**
	 * The book introductions are the reason this page exists.
	 *
	 * "What is the book of Romans about" is a bigger question than any single
	 * chapter of it, and all three sources wrote a real introduction to every book
	 * they covered — several thousand words of licensed, on-topic prose that would
	 * otherwise sit unread behind a chapter route.
	 */
	let overviews: BookOverview[] = [];
	try {
		/**
		 * English only, because the overviews themselves are English.
		 *
		 * These are the public-domain commentary introductions — Tyndale, and the
		 * rest — and they are the reason this page is worth indexing in English.
		 * There is no translated edition of them, so rendering them under a `/pt/`
		 * URL would serve English prose from a Portuguese page: the clearest way to
		 * tell a reader they are in the wrong place and a crawler that the page is a
		 * near-duplicate of the English one.
		 *
		 * A translated book page is therefore its chapter grid plus whatever briefs
		 * the locale has, which is also why it is `noindex` until it has one.
		 */
		overviews = locale.prefix ? [] : await loadBookOverviews(bookUsfm);
	} catch {
		overviews = [];
	}

	setCacheControl(context.response, READER_CACHE_CONTROL);

	const briefs = await chapterBriefIndex(locale);
	/**
	 * Every chapter, with the number this locale writes alongside the one we count
	 * in.
	 *
	 * `id` stays Hebrew because that is what the brief index is keyed by; `label` is
	 * what the tile shows and what its URL ends in. In Russian the Psalms grid
	 * therefore runs 1, 2, ... 8, 9, 9, 10 ... — because Hebrew 9 and 10 are both
	 * Septuagint 9 — which is correct and is exactly what a Russian reader's own
	 * Bible does.
	 */
	const chapters = Array.from({ length: total }, (_, index) => {
		const id = String(index + 1);
		return {
			id,
			label: displayChapterNumber(locale, bookUsfm, id),
			brief: briefs.get(`${bookUsfm}.${id}`),
		};
	});
	const briefedCount = chapters.filter((chapter) => chapter.brief).length;

	/**
	 * A book page earns the index the same way a chapter page does: by carrying
	 * something of ours.
	 *
	 * In English that is the book overviews above, which every book has, so English
	 * book pages are indexable unconditionally as they always were. A translated
	 * book page has no overviews — there is no translated edition of them — so it is
	 * a heading and a grid of numbers until the locale has a brief in this book, and
	 * a grid of numbers is not a page worth putting in front of anyone.
	 */
	const indexable = locale.prefix ? briefedCount > 0 : true;

	/**
	 * BibleHub, StudyLight and the rest — all English, so English only.
	 *
	 * These are "read more elsewhere" links, and their value is that the page on the
	 * other end says something this one does not. In Portuguese or Thai that is not
	 * true of an English interlinear: it is an outbound link to a page the reader
	 * cannot read, which spends this page's link equity for nothing.
	 */
	const externalLinks = locale.prefix ? [] : externalStudyLinks(bookUsfm, 1);

	const title = t.book.title(bookName);
	const description = t.book.description(bookName, total);

	return {
		locale,
		bookSlug,
		bookUsfm,
		bookName,
		total,
		canonicalPath,
		overviews,
		chapters: chapters.map(({ id, label, brief }) => ({
			id,
			label,
			brief: brief ? { data: { title: brief.data.title } } : undefined,
		})),
		briefedCount,
		indexable,
		externalLinks,
		title,
		description,
		site: context.site.href,
	};
}
