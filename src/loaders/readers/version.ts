import type { BibleVersion } from '@youversion/platform-core';
import { editionForSlug } from '../../lib/bible/editions';
import { truncateWords } from '../../lib/bible/text';
import { encodedPath, versionPath } from '../../lib/bible/urls';
import { READER_CACHE_CONTROL, setPageHeaders } from '../../lib/http';
import { localePath } from '../../lib/i18n/locales';
import { breadcrumbJsonLd } from '../../lib/seo';
import {
	displayAbbreviation,
	errorStatus,
	getBibleIndex,
	type IndexedBible,
	resolveVersion,
} from '../../lib/youversion/api';
import type { PageContext } from '../../lib/page/types';
import { isRouteControl } from '../../lib/page/navigation';
import { projectBookList } from './index-projection';

/** Loads the Version view once on the server. */
export async function loadVersion(context: PageContext) {
	const requestedSlug = context.params.version;
	const locale = context.locals.locale;

	if (!requestedSlug) {
		return context.notFound();
	}

	let version: BibleVersion | null = null;
	let slug = requestedSlug;
	let index: IndexedBible | null = null;
	let status = 200;

	try {
		const resolved = await resolveVersion(requestedSlug, locale);
		if (!resolved) {
			return context.notFound();
		}

		if (resolved.slug !== requestedSlug) {
			return context.redirect(encodedPath(versionPath(resolved.slug, locale)), 301);
		}

		version = resolved.version;
		slug = resolved.slug;
		index = await getBibleIndex(resolved.version.id);
	} catch (error) {
		if (isRouteControl(error)) throw error;
		status = errorStatus(error);
		if (status === 404) {
			return context.notFound();
		}
	}

	context.response.status = status;
	setPageHeaders(context.response, status, READER_CACHE_CONTROL);

	/**
	 * Our own writing about this translation, where it exists. Absent for a version
	 * nobody has written up yet, and the page falls back to the book list alone
	 * rather than to an empty section.
	 */
	const edition = locale.prefix ? null : editionForSlug(slug);

	const abbreviation = edition?.abbr ?? (version ? displayAbbreviation(version) : '');
	const title = version
		? `${edition?.name ?? (version.localized_title || version.title)} (${abbreviation})`
		: 'Bible version';

	/**
	 * The title leads with the translation's name because that is the query, and
	 * then says what the page answers — this is not another reader page, it is the
	 * page that tells you whether this is the Bible you should be reading.
	 */
	const pageTitle = edition ? `${title} | How It Reads and Who It’s For` : `${title} · BibleHearth`;
	const breadcrumbs = [
		{ name: 'BibleHearth', path: localePath(locale, '/') },
		...(!locale.prefix ? [{ name: 'Versions', path: '/versions' }] : []),
		{
			name: version ? displayAbbreviation(version) : abbreviation,
			path: versionPath(slug, locale),
		},
	];

	return {
		locale,
		version,
		slug,
		index: index ? projectBookList(index) : null,
		status,
		edition,
		abbreviation,
		title,
		pageTitle,
		breadcrumbs,
		site: context.site.href,
	};
}
