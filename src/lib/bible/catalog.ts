/**
 * Versions deliberately withheld from BibleHearth.
 *
 * Filtering happens at the catalog source, so an excluded version disappears
 * from `/versions`, the home page, the reader toolbar, every sitemap, and slug
 * resolution at once — there is no second place to remember.
 *
 * Excluded by numeric id because ids are stable; the abbreviation is recorded
 * alongside purely so this list stays readable.
 *
 * Two unrelated reasons appear below. TPT is a judgement about the translation
 * itself. Everything after it is a crawl-cost decision: each version carried
 * here is another ~1,189 chapter pages, and every one of those a crawler
 * reaches is an upstream passage fetch against a rate-limited app key — which
 * is what a full-catalogue crawl on a cold cache spent before, returning 503
 * for 1,231 of 1,255 URLs. A version that cannot win the query for its own name
 * does not earn that, so the catalogue is cut to the six with enough search
 * demand behind them to pay for the pages: NIV, AMP, NASB1995, NASB2020, NIrV
 * and BSB.
 *
 * Withheld, not deleted — nothing in the reader is version-specific, so
 * restoring one is deleting its line here. GNV, ASV and WEBUS are the ones
 * worth revisiting: they are public domain, which makes them the only versions
 * whose text could ever be republished as text rather than merely displayed.
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

	// Spelling variants of a version we already carry, or already withhold.
	// Two editions of one translation cannot both win the query for it, and
	// carrying both doubles the fetch cost of serving it.
	{
		id: 113,
		abbreviation: 'NIVUK',
		reason:
			'New International Version (Anglicised) — the NIV in British spelling, competing with the NIV for the NIV’s own queries.',
	},
	{
		id: 1207,
		abbreviation: 'WMBBE',
		reason:
			'World Messianic Bible British Edition — a spelling variant of the WMB, which is withheld below.',
	},

	// Too little search demand for the name to fund a Bible of pages.
	{
		id: 12,
		abbreviation: 'ASV',
		reason:
			'American Standard Version — 1901, and the interlinear sites that quote it already own its queries. Public domain.',
	},
	{
		id: 42,
		abbreviation: 'CPDV',
		reason:
			'Catholic Public Domain Version — Catholic readers search for the NABRE, the RSV-CE or the Douay-Rheims, none of which this app key carries.',
	},
	{
		id: 130,
		abbreviation: 'TOJB2011',
		reason:
			'The Orthodox Jewish Bible — distinctive and identifiable, but too narrow an audience to fund the pages.',
	},
	{
		id: 206,
		abbreviation: 'WEBUS',
		reason:
			'World English Bible — read by other sites as a source of text more than by people. Public domain.',
	},
	{
		id: 1209,
		abbreviation: 'WMB',
		reason:
			'World Messianic Bible — a small and motivated audience, but not a Bible’s worth of search demand.',
	},
	{
		id: 1932,
		abbreviation: 'FBV',
		reason: 'Free Bible Version — almost nobody searches for the name.',
	},
	{
		id: 2079,
		abbreviation: 'EASY',
		reason:
			'EasyEnglish Bible — the low-reading-level audience is real, and the NIrV serves it with far more search demand behind it.',
	},
	{
		id: 2163,
		abbreviation: 'GNV',
		reason:
			'Geneva Bible — a genuine Reformation-history readership, and still too small to fund 1,189 pages. Public domain.',
	},
	{
		id: 2530,
		abbreviation: 'PEV',
		reason:
			'Plain English Version — an Australian Aboriginal English translation. "Plain English bible" has real volume, but what that searcher wants is a Bible that is easy to read, and that is the NIrV.',
	},
	{
		id: 2660,
		abbreviation: 'LSV',
		reason:
			'Literal Standard Version — a small modern following and no query of its own.',
	},
	{
		id: 3427,
		abbreviation: 'TCENT',
		reason:
			'The Text-Critical English New Testament — scholarly, New Testament only, and effectively unsearched.',
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
