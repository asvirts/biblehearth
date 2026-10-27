import type { BibleVersion } from '@youversion/platform-core';
import { isNumericChapter } from '../bible/usfm';

/** Pure display helpers shared by browser and server without loading API clients. */
export function displayAbbreviation(
	version: Pick<BibleVersion, 'abbreviation' | 'localized_abbreviation'>,
): string {
	return version.localized_abbreviation || version.abbreviation;
}

export function versionSlug(
	version: Pick<BibleVersion, 'id' | 'abbreviation' | 'localized_abbreviation'>,
	catalog: ReadonlyArray<Pick<BibleVersion, 'id' | 'abbreviation' | 'localized_abbreviation'>>,
): string {
	const abbreviation = displayAbbreviation(version).toLowerCase();
	const collisions = catalog.filter(
		(item) => displayAbbreviation(item).toLowerCase() === abbreviation,
	);
	return collisions.length > 1 ? `${abbreviation}-${version.id}` : abbreviation;
}

export function readableChapters(book: {
	chapters?: ReadonlyArray<{ id: string; title: string }>;
}) {
	return (book.chapters ?? []).filter((chapter) => isNumericChapter(chapter.id));
}
