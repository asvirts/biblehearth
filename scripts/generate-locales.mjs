/**
 * Regenerates src/lib/i18n/locales.generated.ts — every language this site
 * publishes in, derived rather than hand-listed.
 *
 *   npm run locales:generate
 *
 * The input is the intersection of two things we do not control: the versions
 * Biblica publishes on the YouVersion Platform, and the versions this app key
 * is actually licensed to serve. Neither is guessable and they disagree — of
 * Biblica's 84 languages, 26 are not on this key at all, so a registry written
 * from Biblica's catalogue alone would produce 26 locales whose every page
 * 404s at the upstream.
 *
 * Biblica's ids come from scripts/data/biblica-versions.json, because the
 * Platform API does not report a publisher; that file is a snapshot of the
 * warehouse dimension and the header there says how to refresh it. The key's
 * catalogue is fetched live, which is the half that changes without warning.
 *
 * Everything else — endonym, text direction, URL prefix — is derived from the
 * language tag via Intl, with an override table for the handful CLDR does not
 * know. Deriving beats listing here for one reason: at 58 locales a hand-kept
 * table is 58 chances to typo a language nobody on the team reads.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ApiClient, BibleClient } from '@youversion/platform-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Where CLDR is wrong or silent.
 *
 * `tw` resolves to "Akan" because Twi is a dialect of it, which would put two
 * locales in the switcher under one name. The other three have no CLDR entry at
 * all and fall back to the English name, which is better than a blank.
 */
const ENDONYM_OVERRIDES = {
	tw: 'Twi',
	hne: 'छत्तीसगढ़ी',
	gbr: 'Gbagyi',
	yom: 'Kiyombe',
	// CLDR calls `tl` "Filipino". The Bible in this locale is Ang Salita ng
	// Diyos, a Tagalog translation, and Filipino is the standardised national
	// register built on it — close, and not the same claim.
	tl: 'Tagalog',
};

/**
 * Where the warehouse's ISO 639-1 column cannot be trusted to name the language.
 *
 * Keyed by warehouse tag, because that is the thing that is unambiguous. Two
 * cases, and they fail in different directions:
 *
 * `ckb` is Sorani Kurdish and the warehouse gives its 639-1 as `ku_IQ`. Reading
 * that as `ku` picks up the Kurdish macrolanguage, which CLDR resolves to
 * Kurmanji — a different language, written in Latin script, left to right. The
 * derivation produced a locale called "kurdî (kurmancî)" rendering an Arabic-
 * script Bible in the wrong direction.
 *
 * `fas` is Persian and its 639-1 column is empty, so the derivation fell back
 * to the 639-3 code and produced `/fas/` for a language the whole world spells
 * `fa`.
 */
const IDENTITY_OVERRIDES = {
	ckb: { prefix: 'ckb', htmlLang: 'ckb' },
	fas: { prefix: 'fa', htmlLang: 'fa' },
};

function appKey() {
	for (const file of ['.env.local', '.env']) {
		try {
			const m = readFileSync(join(root, file), 'utf8').match(/^YVP_APP_KEY=(.+)$/m);
			if (m) return m[1].trim();
		} catch {
			/* next */
		}
	}
	if (process.env.YVP_APP_KEY) return process.env.YVP_APP_KEY.trim();
	throw new Error('YVP_APP_KEY not found in .env.local, .env or the environment');
}

/** The URL prefix and the `hreflang`, from a warehouse tag plus its ISO 639-1. */
function identity(warehouseTag, iso1) {
	const override = IDENTITY_OVERRIDES[warehouseTag];
	if (override) return override;

	const [tagBase, tagRegion] = warehouseTag.split('_');
	const base = (iso1 ? iso1.split('_')[0] : tagBase).toLowerCase();
	const region = tagRegion ? tagRegion.toLowerCase() : null;
	return {
		prefix: region ? `${base}-${region}` : base,
		htmlLang: region ? `${base}-${region.toUpperCase()}` : base,
	};
}

function endonym(htmlLang, prefix, fallback) {
	if (ENDONYM_OVERRIDES[prefix]) return ENDONYM_OVERRIDES[prefix];
	try {
		const name = new Intl.DisplayNames([htmlLang], {
			type: 'language',
			fallback: 'none',
		}).of(htmlLang);
		if (name) return name;
	} catch {
		/* fall through */
	}
	return fallback;
}

function direction(htmlLang) {
	try {
		const locale = new Intl.Locale(htmlLang);
		return (locale.getTextInfo?.() ?? locale.textInfo).direction === 'rtl'
			? 'rtl'
			: 'ltr';
	} catch {
		return 'ltr';
	}
}

const biblica = JSON.parse(
	readFileSync(join(root, 'scripts/data/biblica-versions.json'), 'utf8'),
);

const client = new BibleClient(new ApiClient({ appKey: appKey(), timeout: 20000 }));
const catalog = [];
let pageToken;
let pages = 0;
do {
	const page = await client.getVersions('*', undefined, {
		page_size: 99,
		page_token: pageToken,
	});
	catalog.push(...page.data);
	pageToken = page.next_page_token ?? undefined;
	pages += 1;
} while (pageToken && pages < 25);

const served = new Map(catalog.map((v) => [v.id, v]));
const rows = [];
const skipped = [];

for (const [warehouseTag, entry] of Object.entries(biblica)) {
	// English is hand-written in locales.ts: it is the only locale that is a
	// blocklist rather than an allowlist, and the only one already indexed at the
	// site root. Generating it would overwrite that.
	if (warehouseTag === 'eng') continue;

	const versions = entry.versionIds
		.map((id) => served.get(id))
		.filter(Boolean)
		.sort((a, b) => a.id - b.id);

	if (versions.length === 0) {
		skipped.push(entry.name);
		continue;
	}

	const { prefix, htmlLang } = identity(warehouseTag, entry.iso1);

	/**
	 * The default is the lowest-id whole Bible, falling back to the lowest-id
	 * anything. Lowest id rather than newest because it is stable: a new edition
	 * appearing upstream must not silently repoint a locale's canonical URLs.
	 * Whole Bible first because a New Testament default would 404 the Psalms on
	 * a locale that has a complete Bible sitting beside it.
	 */
	const full = versions.filter((v) => v.books.length >= 66);
	const chosen = full[0] ?? versions[0];

	rows.push({
		prefix,
		htmlLang,
		apiLanguageRange: chosen.language_tag,
		dir: direction(htmlLang),
		endonym: endonym(htmlLang, prefix, entry.name),
		englishName: entry.name,
		versionIds: versions.map((v) => v.id),
		defaultVersionId: chosen.id,
		scope: full.length > 0 ? 'full_bible' : 'nt',
		books: chosen.books.length,
	});
}

const clashes = new Map();
for (const row of rows) {
	const seen = clashes.get(row.prefix);
	if (seen) {
		throw new Error(
			`prefix "${row.prefix}" claimed by both ${seen} and ${row.englishName} — ` +
				'add one to PREFIX_OVERRIDES',
		);
	}
	clashes.set(row.prefix, row.englishName);
}

rows.sort((a, b) => a.englishName.localeCompare(b.englishName));

const body = rows
	.map(
		(row) => `	{
		code: '${row.prefix}',
		prefix: '${row.prefix}',
		htmlLang: '${row.htmlLang}',
		apiLanguageRange: '${row.apiLanguageRange}',
		dir: '${row.dir}',
		endonym: ${JSON.stringify(row.endonym)},
		englishName: ${JSON.stringify(row.englishName)},
		versionIds: [${row.versionIds.join(', ')}],
		defaultVersionId: ${row.defaultVersionId},
		scope: '${row.scope}',
	},`,
	)
	.join('\n');

writeFileSync(
	join(root, 'src/lib/i18n/locales.generated.ts'),
	`// Generated by scripts/generate-locales.mjs — do not edit by hand.\n` +
		`// ${rows.length} locales: Biblica versions this app key is licensed to serve.\n` +
		`import type { Locale } from './locales';\n\n` +
		`export const GENERATED_LOCALES: readonly Locale[] = [\n${body}\n];\n`,
);

/**
 * The same table as JSON, for the scripts that come after this one.
 *
 * Sibling scripts read this rather than importing locales.ts: Node resolves ESM
 * with explicit extensions and the app's imports are extensionless, so a script
 * that imports the registry breaks on a detail that has nothing to do with it.
 * English is included even though it generates nothing, so a consumer can see
 * the whole set.
 */
writeFileSync(
	join(root, 'scripts/data/locales.json'),
	JSON.stringify(
		[
			{ code: 'en', prefix: '', englishName: 'English', defaultVersionId: 111, scope: 'full_bible' },
			...rows.map(({ books, ...row }) => ({ code: row.prefix, ...row })),
		],
		null,
		1,
	) + '\n',
);

const nt = rows.filter((r) => r.scope === 'nt');
console.log(`${rows.length} locales written, ${rows.reduce((n, r) => n + r.versionIds.length, 0)} versions`);
console.log(`whole Bible: ${rows.length - nt.length}   New Testament only: ${nt.length} (${nt.map((r) => r.prefix).join(', ')})`);
console.log(`rtl: ${rows.filter((r) => r.dir === 'rtl').map((r) => r.prefix).join(', ')}`);
console.log(`\nBiblica languages this key does not serve (${skipped.length}): ${skipped.join(', ')}`);
