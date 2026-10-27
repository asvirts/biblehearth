import assert from 'node:assert/strict';
import test from 'node:test';
import { matchPage } from '../src/lib/page/routes';
import { buildPageContext } from '../src/lib/page/context';
import { LOCALES } from '../src/lib/i18n/locales';
import { bookSlug, localizedBooks } from '../src/lib/bible/books';
import { chapterStudyPath } from '../src/lib/commentary/paths';
import { hebrewChapter } from '../src/lib/bible/psalms';
import { GET as read } from '../src/resources/read';

test('every registered locale and book stays routable with canonical Unicode paths', () => {
	let count = 0;
	for (const locale of LOCALES) {
		for (const book of localizedBooks(locale)) {
			const path = chapterStudyPath(book.usfm, 1, locale);
			const url = new URL(path, 'https://biblehearth.online');
			const match = matchPage(url.pathname);
			assert.equal(match.kind, 'StudyChapter');
			assert.equal(match.params.book, bookSlug(locale, book.usfm));
			assert.equal(buildPageContext(new Request(url)).locals.locale.code, locale.code);
			count++;
		}
	}
	assert.ok(count > 3000);
	const russian = LOCALES.find((locale) => locale.code === 'ru')!;
	assert.equal(hebrewChapter(russian, 'PSA', 90), 91);
});

test('static hubs beat the 66 book names and malformed nested paths never become valid books', () => {
	for (const path of ['/study', '/topics', '/answers', '/versions', '/about'])
		assert.notEqual(matchPage(path).kind, 'StudyBook');
	assert.equal(matchPage('/john').kind, 'StudyBook');
	assert.equal(matchPage('/job/1').kind, 'StudyChapter');
	for (const path of ['/verse/john/1/1/extra', '/john%2F3/1', '/%ZZ/1'])
		assert.equal(matchPage(path).kind, 'NotFound');
});

test('locale selection ignores client-supplied headers', () => {
	const context = buildPageContext(
		new Request('https://biblehearth.online/psalms/28', {
			headers: { 'x-biblehearth-lang': 'ar', 'x-biblehearth-rewrite-locale': 'ar' },
		}),
	);
	assert.equal(context.locals.locale.code, 'en');
});

test('reader redirects are same-origin relative locations even with an untrusted Host', async () => {
	const context = buildPageContext(
		new Request('https://untrusted.example/read?version=niv&book=psalms&chapter=28'),
	);
	const response = await read(context);
	assert.equal(response.status, 302);
	assert.equal(response.headers.get('location'), '/bible/niv/psalms/28');
});
