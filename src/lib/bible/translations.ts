/**
 * Translations shown side by side on a verse hub, in display order.
 *
 * Curated rather than "all of them": rendering every licensed version would
 * multiply the upstream cost per page for almost no additional keyword
 * coverage, and a wall of thirty near-identical renderings is worse to read.
 * Matched against the slug, so entries that are not licensed are skipped
 * silently.
 */
export const HUB_TRANSLATION_SLUGS: readonly string[] = [
	'niv',
	'nasb2020',
	'amp',
	'bsb',
	'asv',
	'gnv',
	'webus',
	'nirv',
	'easy',
	'lsv',
];

/** Cap on how many actually render, in case the list grows. */
export const HUB_TRANSLATION_LIMIT = 10;
