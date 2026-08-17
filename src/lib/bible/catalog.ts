/**
 * Versions deliberately withheld from BibleHearth.
 *
 * Filtering happens at the catalog source, so an excluded version disappears
 * from `/versions`, the home page, the reader toolbar, every sitemap, and slug
 * resolution at once — there is no second place to remember.
 *
 * Excluded by numeric id because ids are stable; the abbreviation is recorded
 * alongside purely so this list stays readable.
 */
const EXCLUDED_VERSIONS: ReadonlyArray<{
	id: number;
	abbreviation: string;
	reason: string;
}> = [
	{
		id: 1849,
		abbreviation: 'TPT',
		reason: 'The Passion Translation — excluded by editorial decision.',
	},
];

const EXCLUDED_IDS = new Set(EXCLUDED_VERSIONS.map((entry) => entry.id));

const EXCLUDED_ABBREVIATIONS = new Set(
	EXCLUDED_VERSIONS.map((entry) => entry.abbreviation.toLowerCase()),
);

export function isExcludedVersion(
	version: Pick<
		{ id: number; abbreviation: string; localized_abbreviation: string },
		'id' | 'abbreviation' | 'localized_abbreviation'
	>,
): boolean {
	return (
		EXCLUDED_IDS.has(version.id) ||
		EXCLUDED_ABBREVIATIONS.has(version.abbreviation.toLowerCase()) ||
		EXCLUDED_ABBREVIATIONS.has(
			(version.localized_abbreviation || '').toLowerCase(),
		)
	);
}

export function isExcludedVersionId(id: number): boolean {
	return EXCLUDED_IDS.has(id);
}
