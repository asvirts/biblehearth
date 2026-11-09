import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import {
	bookRow,
	bookTableIndex,
	bookTableSource,
	knownBookId,
	localeRow,
	sourceLiteral,
} from '../scripts/lib/generated-sources.mjs';

test('provider text stays data when generated book and locale rows are evaluated', () => {
	const hostile = `'); globalThis.executed = true; //\n\u2028\u2029`;
	const bookContext = { executed: false };
	const book = runInNewContext(
		`(${bookRow({ usfm: 'JHN', slug: 'john', name: hostile })})`,
		bookContext,
	);
	assert.equal(book.name, hostile);
	assert.equal(bookContext.executed, false);
	const fullSource = bookTableSource(
		{
			code: 'es',
			prefix: 'es',
			englishName: '\nglobalThis.executed = true; //\u2028',
			defaultVersionId: 128,
		},
		[{ usfm: 'JHN', slug: 'john', name: hostile }],
	);
	const executable = fullSource
		.replace(/^import type .*\n/m, '')
		.replace('export const BOOKS: readonly LocalizedBook[] =', 'globalThis.books =');
	const moduleContext = { executed: false, books: [] as { name: string }[] };
	runInNewContext(executable, moduleContext);
	assert.equal(moduleContext.executed, false);
	assert.equal(moduleContext.books[0]?.name, hostile);

	const localeContext = { executed: false };
	const locale = runInNewContext(
		`(${localeRow({
			prefix: 'zh-tw',
			htmlLang: 'zh-TW',
			apiLanguageRange: 'zh-Hant-TW',
			dir: 'ltr',
			endonym: hostile,
			englishName: hostile,
			versionIds: [1392],
			defaultVersionId: 1392,
			scope: 'full_bible',
		})})`,
		localeContext,
	);
	assert.equal(locale.endonym, hostile);
	assert.equal(locale.englishName, hostile);
	assert.equal(localeContext.executed, false);
	assert.ok(!sourceLiteral(hostile).includes('\u2028'));
	assert.ok(!sourceLiteral(hostile).includes('\u2029'));
});

test('generated identifiers, language tags and numeric values reject source syntax and traversal', () => {
	for (const id of ["JHN');globalThis.executed=true;//", 'JHN\n', '../', '1']) {
		assert.throws(() => bookRow({ usfm: id, slug: 'john', name: 'John' }), /Invalid book ID/);
	}
	assert.equal(knownBookId('5EZ', new Set(['5EZ'])), '5EZ');
	assert.throws(() => knownBookId('XYZ', new Set(['JHN'])), /Unknown book ID/);
	for (const code of ['../en', 'en/../../x', "en';run()//", 'en\nrun()', '__proto__']) {
		assert.throws(() => bookTableIndex([code]), /Invalid locale code/);
	}
	assert.throws(() => bookTableIndex(['en', 'en']), /Duplicate locale/);
	const base = {
		prefix: 'es',
		htmlLang: 'es',
		apiLanguageRange: 'es',
		dir: 'ltr',
		endonym: 'Español',
		englishName: 'Spanish',
		versionIds: [128],
		defaultVersionId: 128,
		scope: 'full_bible',
	};
	assert.throws(
		() => localeRow({ ...base, apiLanguageRange: "es');run();//" }),
		/Invalid language tag/,
	);
	assert.throws(() => localeRow({ ...base, versionIds: ['128];run();//'] }), /Invalid version ID/);
	assert.throws(
		() => localeRow({ ...base, defaultVersionId: Number.MAX_SAFE_INTEGER + 1 }),
		/Invalid version ID/,
	);
	assert.throws(() => localeRow({ ...base, defaultVersionId: 129 }), /Default version/);
});

test('existing generated locale metadata remains accepted', async () => {
	const locales = JSON.parse(
		await readFile(new URL('../scripts/data/locales.json', import.meta.url), 'utf8'),
	);
	for (const locale of locales.filter((entry: { prefix: string }) => entry.prefix)) {
		assert.doesNotThrow(() => localeRow(locale), locale.code);
	}
});
