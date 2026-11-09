/**
 * Regenerates the per-locale book slug tables under `src/lib/bible/books/`.
 *
 *   npm run books:generate
 *
 * The slugs are not invented here and they are not translated by us: they are
 * the publisher's own book titles for each locale's default version, slugified.
 * That matters twice over. The title is what the reader sees at the top of the
 * chapter, so the URL and the heading agree by construction rather than by
 * anyone remembering to keep them agreeing. And it is the spelling readers of
 * that language actually type — German readers search "1. Mose", not "Genesis",
 * and no table written from English could have known that.
 *
 * Committed rather than fetched at build time. A slug is a URL, a URL is a
 * promise, and a promise must not change because an upstream edition was
 * retitled between deploys. When it does change, it changes in a reviewable
 * diff with a redirect written alongside it.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ApiClient, BibleClient, BOOK_IDS } from '@youversion/platform-core';
import { slugifyBookTitle } from '../src/lib/bible/books/slug.ts';
import {
	bookTableIndex,
	bookTableSource,
	knownBookId,
	localeCode,
	versionId,
} from './lib/generated-sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = JSON.parse(
	readFileSync(join(root, 'scripts/data/locales.json'), 'utf8'),
);
const outDir = join(root, 'src/lib/bible/books');

function appKey() {
	for (const file of ['.env.local', '.env']) {
		try {
			const match = readFileSync(join(root, file), 'utf8').match(
				/^YVP_APP_KEY=(.+)$/m,
			);
			if (match) return match[1].trim();
		} catch {
			/* next */
		}
	}
	if (process.env.YVP_APP_KEY) return process.env.YVP_APP_KEY.trim();
	throw new Error('YVP_APP_KEY not found in .env.local, .env or the environment');
}

const client = new BibleClient(new ApiClient({ appKey: appKey(), timeout: 20000 }));
mkdirSync(outDir, { recursive: true });

const summary = [];
const emitted = [];
const validBookIds = new Set(BOOK_IDS);

for (const locale of LOCALES) {
	const code = localeCode(locale.code);
	const selectedVersion = versionId(locale.defaultVersionId);
	// English's table is hand-kept in lib/bible/usfm.ts and covers 103 books
	// including the deuterocanon, which no locale here carries. Regenerating it
	// from a version index would silently drop 37 of them.
	if (!locale.prefix) continue;
	if (locale.prefix !== code) throw new Error('Locale prefix does not match locale code');

	const index = await client.getIndex(selectedVersion);
	const seen = new Map();
	const rows = [];

	for (const book of index.books) {
		const usfm = knownBookId(book.id, validBookIds);
		const slug = slugifyBookTitle(book.title);
		if (!slug) {
			throw new Error(`${locale.code}: ${book.id} "${book.title}" slugified to nothing`);
		}
		const clash = seen.get(slug);
		if (clash) {
			throw new Error(
				`${locale.code}: ${book.id} and ${clash} both slugify to "${slug}" — ` +
					'the publisher titles collide and one needs an override',
			);
		}
		seen.set(slug, usfm);
		rows.push({ usfm, slug, name: book.title });
	}

	writeFileSync(join(outDir, `${code}.ts`), bookTableSource(locale, rows));

	emitted.push(code);
	summary.push(
		`${locale.code.padEnd(6)} ${String(rows.length).padStart(3)} books  ${rows.slice(0, 3).map((r) => r.slug).join(', ')}`,
	);
}

/**
 * The index, generated alongside the tables.
 *
 * Hand-writing 57 imports was fine at eight and is a merge conflict at fifty —
 * and an import quietly missing from it is a locale that silently has no book
 * names, which is the failure mode that already cost us English once.
 */
writeFileSync(join(outDir, 'tables.ts'), bookTableIndex(emitted));

console.log(summary.join('\n'));
console.log(`\n${emitted.length} locale tables + tables.ts written`);
