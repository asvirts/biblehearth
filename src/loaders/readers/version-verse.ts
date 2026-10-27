import type { BiblePassage, BibleVersion } from '@youversion/platform-core';
import { isCanonicalLocaleBookSlug, usfmFromLocaleBookSlug } from '../../lib/bible/books';
import { hebrewChapter } from '../../lib/bible/psalms';
import { bookSlugFromUsfm, isNumericChapter, isNumericVerse } from '../../lib/bible/usfm';
import { scriptureToPlainText, truncateWords } from '../../lib/bible/text';
import { bookPath, chapterPath, encodedPath, versePath, versionPath } from '../../lib/bible/urls';
import { READER_CACHE_CONTROL, setPageHeaders } from '../../lib/http';
import { localePath } from '../../lib/i18n/locales';
import { breadcrumbJsonLd, creativeWorkJsonLd } from '../../lib/seo';
import {
	displayAbbreviation,
	errorStatus,
	findBook,
	getBibleIndex,
	getVerseHtml,
	type IndexedBook,
	resolveVersion,
	verseExists,
} from '../../lib/youversion/api';
import type { PageContext } from '../../lib/page/types';
import { isRouteControl } from '../../lib/page/navigation';
import { projectBookLabel } from './index-projection';

/** Loads the VersionVerse view once on the server. */
export async function loadVersionVerse(context: PageContext) {
	const requestedSlug = context.params.version;
	const bookSlug = context.params.book;
	const requestedChapter = context.params.chapter;
	const verseId = context.params.verse;
	const locale = context.locals.locale;

	if (
		!requestedSlug ||
		!bookSlug ||
		!requestedChapter ||
		!verseId ||
		!isNumericChapter(requestedChapter) ||
		!isNumericVerse(verseId)
	) {
		return context.notFound();
	}

	const bookUsfm = usfmFromLocaleBookSlug(locale, bookSlug);
	const normalizedChapter = bookUsfm ? hebrewChapter(locale, bookUsfm, requestedChapter) : null;
	const chapterId = normalizedChapter === null ? null : String(normalizedChapter);
	if (!bookUsfm || !chapterId) {
		return context.notFound();
	}

	// Ahead of the version lookup for the same reason as the chapter route: an
	// aliased book spelling is answerable from the URL alone.
	if (!isCanonicalLocaleBookSlug(locale, bookSlug, bookUsfm)) {
		return context.redirect(
			encodedPath(versePath(requestedSlug, bookUsfm, chapterId, verseId, locale)),
			301,
		);
	}

	let version: BibleVersion | null = null;
	let slug = requestedSlug;
	let book: IndexedBook | null = null;
	let passage: BiblePassage | null = null;
	let status = 200;

	try {
		const resolved = await resolveVersion(requestedSlug, locale);
		if (!resolved) {
			return context.notFound();
		}

		if (resolved.slug !== requestedSlug) {
			return context.redirect(
				encodedPath(versePath(resolved.slug, bookUsfm, chapterId, verseId, locale)),
				301,
			);
		}

		version = resolved.version;
		slug = resolved.slug;
		const index = await getBibleIndex(resolved.version.id);
		book = findBook(index, bookUsfm);
		if (!book || !verseExists(book, chapterId, verseId)) {
			return context.notFound();
		}

		// Sliced out of the chapter's cache entry rather than fetched on its own.
		// These pages are the largest crawlable surface on the site and the one no
		// sitemap submits, so a key per verse was a guaranteed cold fetch per crawl;
		// see getVerseHtml.
		passage = await getVerseHtml(resolved.version.id, bookUsfm, chapterId, verseId);
		if (!passage) {
			return context.notFound();
		}
	} catch (error) {
		if (isRouteControl(error)) throw error;
		status = errorStatus(error);
		if (status === 404) {
			return context.notFound();
		}
	}

	context.response.status = status;
	setPageHeaders(context.response, status, READER_CACHE_CONTROL);

	const heading =
		passage?.reference ||
		(book && version
			? `${book.title} ${requestedChapter}:${verseId} (${displayAbbreviation(version)})`
			: 'Verse');
	const abbreviation = version ? displayAbbreviation(version) : '';
	// Chapter pages carry the abbreviation but `passage.reference` does not,
	// so verse titles used to silently drop the version.
	const verseText = passage ? scriptureToPlainText(passage.content) : '';
	const title = verseText
		? `${heading} ${abbreviation} — ${truncateWords(verseText, 50)}`
		: `${heading} ${abbreviation} · BibleHearth`.replace('  ', ' ');
	const description = verseText
		? truncateWords(
				`${verseText} — ${heading}, ${abbreviation}. Read the full chapter and compare translations.`,
				155,
			)
		: `Read ${heading} on BibleHearth.`;

	return {
		requestedChapter,
		verseId,
		locale,
		bookUsfm,
		chapterId,
		version,
		slug,
		book: book ? projectBookLabel(book) : null,
		passage,
		status,
		heading,
		title,
		description,
		site: context.site.href,
	};
}
