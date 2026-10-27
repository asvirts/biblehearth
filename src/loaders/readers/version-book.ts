import type { BibleVersion } from '@youversion/platform-core';
import { isCanonicalLocaleBookSlug, usfmFromLocaleBookSlug } from '../../lib/bible/books';
import { bookPath, encodedPath, versionPath } from '../../lib/bible/urls';
import { READER_CACHE_CONTROL, setPageHeaders } from '../../lib/http';
import { localePath } from '../../lib/i18n/locales';
import { breadcrumbJsonLd } from '../../lib/seo';
import {
	displayAbbreviation,
	errorStatus,
	findBook,
	getBibleIndex,
	type IndexedBook,
	resolveVersion,
} from '../../lib/youversion/api';
import type { PageContext } from '../../lib/page/types';
import { isRouteControl } from '../../lib/page/navigation';
import { projectChapterList } from './index-projection';

/** Loads the VersionBook view once on the server. */
export async function loadVersionBook(context: PageContext) {
	const requestedSlug = context.params.version;
	const bookSlug = context.params.book;
	const locale = context.locals.locale;

	if (!requestedSlug || !bookSlug) {
		return context.notFound();
	}

	const bookUsfm = usfmFromLocaleBookSlug(locale, bookSlug);
	if (!bookUsfm) {
		return context.notFound();
	}

	// Ahead of the version lookup for the same reason as the chapter route: an
	// aliased book spelling is answerable from the URL alone.
	if (!isCanonicalLocaleBookSlug(locale, bookSlug, bookUsfm)) {
		return context.redirect(encodedPath(bookPath(requestedSlug, bookUsfm, locale)), 301);
	}

	let version: BibleVersion | null = null;
	let slug = requestedSlug;
	let book: IndexedBook | null = null;
	let status = 200;

	try {
		const resolved = await resolveVersion(requestedSlug, locale);
		if (!resolved) {
			return context.notFound();
		}

		if (resolved.slug !== requestedSlug) {
			return context.redirect(encodedPath(bookPath(resolved.slug, bookUsfm, locale)), 301);
		}

		version = resolved.version;
		slug = resolved.slug;
		const loadedIndex = await getBibleIndex(resolved.version.id);
		book = findBook(loadedIndex, bookUsfm);
		if (!book) {
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

	const bookTitle = book?.title ?? bookSlug;
	const versionLabel = version ? displayAbbreviation(version) : '';

	return {
		locale,
		bookUsfm,
		version,
		slug,
		book: book ? projectChapterList(book) : null,
		status,
		bookTitle,
		versionLabel,
		site: context.site.href,
	};
}
