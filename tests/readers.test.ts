import assert from 'node:assert/strict';
import test from 'node:test';
import superjson from 'superjson';
import { DEFAULT_LOCALE, localeForCode, type Locale } from '../src/lib/i18n/locales';
import { RouteControl } from '../src/lib/page/navigation';
import type { PageContext } from '../src/lib/page/types';

function context(
	params: Record<string, string> = {},
	locale: Locale = DEFAULT_LOCALE,
): PageContext {
	const url = new URL('https://biblehearth.online/');
	return {
		params,
		url,
		site: new URL(url.origin),
		locals: { locale, localePath: '/' },
		request: new Request(url),
		response: { status: 200, headers: new Headers() },
		redirect(path, status = 302): never {
			throw new RouteControl(status, path);
		},
		notFound(): never {
			throw new RouteControl(404);
		},
	};
}

function assertDataOnly(value: unknown, path = 'model', seen = new Set<object>()): void {
	assert.notEqual(typeof value, 'function', `${path} contains a function`);
	if (!value || typeof value !== 'object' || seen.has(value)) return;
	seen.add(value);
	if (value instanceof Map) {
		for (const [key, entry] of value) assertDataOnly(entry, `${path}.${String(key)}`, seen);
	} else if (value instanceof Set) {
		for (const entry of value) assertDataOnly(entry, `${path}.<set>`, seen);
	} else {
		for (const [key, entry] of Object.entries(value)) assertDataOnly(entry, `${path}.${key}`, seen);
	}
}

test('all reader loaders produce serializable models and synchronous views without an upstream key', async () => {
	// Imports are dynamic so no installed app key is read by the fixture. A real
	// upstream failure must remain a retryable status while original writing can
	// still render, and the fixture must spend no licensed-passage requests.
	const originalKey = process.env.YVP_APP_KEY;
	const originalFetch = globalThis.fetch;
	process.env.YVP_APP_KEY = '';
	let fetchCalls = 0;
	globalThis.fetch = async () => {
		fetchCalls++;
		throw new Error('Unexpected upstream request');
	};
	try {
		const [sb, sc, v, vb, vc, vv, vh, vd, vs, nf] = await Promise.all([
			import('../src/loaders/readers/study-book'),
			import('../src/loaders/readers/study-chapter'),
			import('../src/loaders/readers/version'),
			import('../src/loaders/readers/version-book'),
			import('../src/loaders/readers/version-chapter'),
			import('../src/loaders/readers/version-verse'),
			import('../src/loaders/readers/verse-hub'),
			import('../src/loaders/readers/verse-of-the-day'),
			import('../src/loaders/readers/versions'),
			import('../src/loaders/readers/not-found'),
		]);
		const [sbv, scv, vview, vbv, vcv, vvv, vhv, vdv, vsv, nfv] = await Promise.all([
			import('../src/views/readers/study-book'),
			import('../src/views/readers/study-chapter'),
			import('../src/views/readers/version'),
			import('../src/views/readers/version-book'),
			import('../src/views/readers/version-chapter'),
			import('../src/views/readers/version-verse'),
			import('../src/views/readers/verse-hub'),
			import('../src/views/readers/verse-of-the-day'),
			import('../src/views/readers/versions'),
			import('../src/views/readers/not-found'),
		]);
		const pt = localeForCode('pt');
		assert.ok(pt);
		// Keep each loader paired with its own renderer; superjson is the same
		// model transport used by getServerSideProps and supports dates and maps.
		const run = (load: (ctx: PageContext) => Promise<unknown>, ctx: PageContext) => async () => ({
			model: await load(ctx),
			status: ctx.response.status,
		});
		const cases = [
			{
				label: 'study book',
				run: run(sb.loadStudyBook, context({ book: 'salmo' }, pt)),
				render: sbv.renderStudyBook,
				status: 200,
			},
			{
				label: 'study chapter',
				run: run(sc.loadStudyChapter, context({ book: 'salmo', chapter: '91' }, pt)),
				render: scv.renderStudyChapter,
				status: 200,
			},
			{
				label: 'version',
				run: run(v.loadVersion, context({ version: 'niv' })),
				render: vview.renderVersion,
				status: 503,
			},
			{
				label: 'version book',
				run: run(vb.loadVersionBook, context({ version: 'niv', book: 'john' })),
				render: vbv.renderVersionBook,
				status: 503,
			},
			{
				label: 'version chapter',
				run: run(vc.loadVersionChapter, context({ version: 'niv', book: 'john', chapter: '1' })),
				render: vcv.renderVersionChapter,
				status: 503,
			},
			{
				label: 'version verse',
				run: run(
					vv.loadVersionVerse,
					context({ version: 'niv', book: 'john', chapter: '1', verse: '1' }),
				),
				render: vvv.renderVersionVerse,
				status: 503,
			},
			{
				label: 'verse hub',
				run: run(vh.loadVerseHub, context({ book: 'john', chapter: '1', verse: '1' })),
				render: vhv.renderVerseHub,
				status: 503,
			},
			{
				label: 'verse of the day',
				run: run(vd.loadVerseOfTheDay, context()),
				render: vdv.renderVerseOfTheDay,
				status: 503,
			},
			{
				label: 'versions',
				run: run(vs.loadVersions, context()),
				render: vsv.renderVersions,
				status: 503,
			},
			{
				label: 'not found',
				run: run(nf.loadNotFound, context()),
				render: nfv.renderNotFound,
				status: 404,
			},
		];
		for (const item of cases) {
			const { model, status } = await item.run();
			assert.equal(status, item.status, `${item.label} HTTP status`);
			assertDataOnly(model);
			const restored = superjson.parse(superjson.stringify(model));
			// The correlated loader/renderer pairs above have different model types.
			const element = (
				item.render as (value: never) => { props: { title: string; description: string } }
			)(restored as never);
			assert.ok(element.props.title, `${item.label} title`);
			assert.ok(element.props.description, `${item.label} description`);
			if (item.label === 'study chapter') {
				const chapter = restored as Awaited<ReturnType<typeof sc.loadStudyChapter>>;
				assert.ok(chapter.passages instanceof Map);
				assert.ok(chapter.brief?.data.reviewedAt instanceof Date);
				assert.equal(chapter.canonicalPath, '/pt/salmo/91');
				assert.equal(chapter.indexable, true);
				assert.ok(chapter.brief && !Object.hasOwn(chapter.brief, 'body'));
				assert.equal(typeof chapter.bodyHtml, 'string');
			}
			if (item.label === 'study book') {
				const book = restored as Awaited<ReturnType<typeof sb.loadStudyBook>>;
				const briefed = book.chapters.filter((chapter) => chapter.brief);
				assert.ok(briefed.length > 0);
				assert.ok(
					briefed.every(
						(chapter) => chapter.brief && Object.keys(chapter.brief.data).join() === 'title',
					),
				);
			}
		}
		assert.equal(fetchCalls, 0);
	} finally {
		globalThis.fetch = originalFetch;
		if (originalKey === undefined) delete process.env.YVP_APP_KEY;
		else process.env.YVP_APP_KEY = originalKey;
	}
});

test('invalid references and aliases retain their 404 and 301 decisions', async () => {
	const { loadVerseHub } = await import('../src/loaders/readers/verse-hub');
	const { loadStudyChapter } = await import('../src/loaders/readers/study-chapter');
	await assert.rejects(
		loadVerseHub(context({ book: 'john', chapter: '1', verse: 'bad' })),
		(error: unknown) => error instanceof RouteControl && error.status === 404,
	);
	await assert.rejects(
		loadStudyChapter(context({ book: 'psalms', chapter: '0' })),
		(error: unknown) => error instanceof RouteControl && error.status === 404,
	);
	await assert.rejects(
		loadVerseHub(context({ book: 'psa', chapter: '28', verse: '1' })),
		(error: unknown) =>
			error instanceof RouteControl &&
			error.status === 301 &&
			error.location === '/verse/psalms/28/1',
	);
});
