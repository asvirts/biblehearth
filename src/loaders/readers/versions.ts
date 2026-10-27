import type { BibleVersion } from '@youversion/platform-core';
import { editionForSlug, editionStyle } from '../../lib/bible/editions';
import { absoluteUrl, versionPath } from '../../lib/bible/urls';
import { READER_CACHE_CONTROL, setPageHeaders } from '../../lib/http';
import { breadcrumbJsonLd, itemListJsonLd } from '../../lib/seo';
import {
	displayAbbreviation,
	errorStatus,
	listVersions,
	versionSlug,
} from '../../lib/youversion/api';
import type { PageContext } from '../../lib/page/types';

/** Loads the Versions view once on the server. */
export async function loadVersions(context: PageContext) {
	let versions: BibleVersion[] = [];
	let status = 200;
	let errorTitle = '';
	let errorMessage = '';

	try {
		versions = await listVersions();
	} catch (error) {
		status = errorStatus(error);
		errorTitle = 'Versions are unavailable';
		errorMessage = 'The Bible catalog could not be loaded right now.';
	}

	context.response.status = status;
	setPageHeaders(context.response, status, READER_CACHE_CONTROL);

	/**
	 * Each version paired with what we have written about it.
	 *
	 * The style label and the reading level are the two facts someone choosing a
	 * translation is actually comparing, and both already exist in
	 * lib/bible/editions.ts — the style derived from `approach` so the two can
	 * never disagree. A version with no record still lists; it just lists without
	 * them, which is the same fallback `/bible/<slug>` uses.
	 */
	const listed = versions.map((version) => {
		const slug = versionSlug(version, versions);
		const edition = editionForSlug(slug);
		return {
			slug,
			path: versionPath(slug),
			abbr: displayAbbreviation(version),
			name: edition?.name ?? version.localized_title ?? version.title,
			style: edition ? editionStyle(edition) : null,
			grade: edition?.readingGrade ?? null,
		};
	});

	return {
		status,
		errorTitle,
		errorMessage,
		listed,
		site: context.site.href,
	};
}
