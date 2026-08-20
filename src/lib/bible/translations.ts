/**
 * Translations shown side by side on a verse hub, in display order.
 *
 * Curated rather than "all of them": rendering every licensed version would
 * multiply the upstream cost per page for almost no additional keyword
 * coverage, and a wall of thirty near-identical renderings is worse to read.
 * Matched against the slug, so entries that are not licensed are skipped
 * silently.
 *
 * This is now the whole catalogue rather than a subset of it — see
 * lib/bible/catalog.ts for why the catalogue was cut to six. Order still is not
 * arbitrary: the NIV first because it is the default everywhere else, then the
 * two NASB editions adjacent so the 1995-to-2020 wording changes read as a
 * comparison rather than as two unrelated renderings, then the NIrV last, since
 * a reader who needed the plainest wording is best served by meeting it after
 * the others have not helped.
 */
export const HUB_TRANSLATION_SLUGS: readonly string[] = [
	'niv',
	'nasb2020',
	'nasb1995',
	'amp',
	'bsb',
	'nirv',
];

/** Cap on how many actually render, in case the list grows. */
export const HUB_TRANSLATION_LIMIT = 10;
