import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { loadStudy } from '../src/loaders/editorial/Study';
import { Study } from '../src/views/editorial/Study';
import type { PageContext } from '../src/lib/page/types';
import { DEFAULT_LOCALE } from '../src/lib/i18n/locales';
import { listVerseBriefs } from '../src/lib/verse-briefs';
import { verseHubPath } from '../src/lib/bible/urls';

test('the study hub exposes published verse explanations as crawlable links without fetching Scripture', async () => {
	const url = new URL('https://biblehearth.online/study');
	const ctx: PageContext = {
		url,
		site: new URL(url.origin),
		params: {},
		locals: { locale: DEFAULT_LOCALE, localePath: '/study' },
		request: new Request(url),
		response: { status: 200, headers: new Headers() },
		redirect: () => {
			throw new Error('Unexpected redirect');
		},
		notFound: () => {
			throw new Error('Unexpected 404');
		},
	};
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => {
		throw new Error('The editorial hub must not fetch Scripture');
	};
	try {
		const model = await loadStudy(ctx);
		const authored = await listVerseBriefs();
		assert.ok(authored.length > 0);
		assert.deepEqual(
			new Set(model.verseExplanations.map(({ href }) => href)),
			new Set(authored.map(({ data }) => verseHubPath(data.usfm))),
		);
		const page = Study(model);
		const html = renderToStaticMarkup((page.props as { children: ReactNode }).children);
		for (const { href } of model.verseExplanations) {
			assert.ok(html.includes(`href="${href}"`), `${href} must be a server-rendered anchor`);
		}
		assert.ok(html.indexOf('Verse meanings and context') < html.indexOf('Old Testament'));
		assert.doesNotMatch(html, /\/verse\/psalms\/28\/1/);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
