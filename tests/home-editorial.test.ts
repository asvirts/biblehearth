import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderToReadableStream } from 'react-dom/server';
import type { ReactNode } from 'react';

test('home links published verse explanations in server HTML and excludes drafts without Scripture access', async () => {
	const project = process.cwd();
	const temp = await mkdtemp(path.join(tmpdir(), 'home-editorial-'));
	const content = path.join(temp, 'src/content');
	await mkdir(path.join(content, 'verses'), { recursive: true });
	for (const collection of ['topics', 'answers', 'chapters']) {
		await symlink(path.join(project, 'src/content', collection), path.join(content, collection));
	}
	const source = await readFile(path.join(project, 'src/content/verses/isaiah-41-10.md'), 'utf8');
	await writeFile(path.join(content, 'verses/isaiah-41-10.md'), source);
	await writeFile(
		path.join(content, 'verses/john-1-1.md'),
		source
			.replace('ISA.41.10', 'JHN.1.1')
			.replace('draft: false', 'draft: true')
			.replace(
				'What Does Isaiah 41:10 Mean When It Says Do Not Fear?',
				'Draft explanation must stay hidden',
			),
	);
	const oldKey = process.env.YVP_APP_KEY;
	const oldFetch = globalThis.fetch;
	process.env.YVP_APP_KEY = '';
	let requests = 0;
	globalThis.fetch = async () => {
		requests++;
		throw new Error('Unexpected network request');
	};
	try {
		process.chdir(temp);
		const [{ loadHome }, { Home }, { DEFAULT_LOCALE }] = await Promise.all([
			import('../src/loaders/editorial/Home'),
			import('../src/views/editorial/Home'),
			import('../src/lib/i18n/locales'),
		]);
		const site = new URL('https://biblehearth.online/');
		const model = await loadHome({
			site,
			url: site,
			params: {},
			locals: { locale: DEFAULT_LOCALE, localePath: '/' },
			request: new Request(site),
			response: { status: 200, headers: new Headers() },
			redirect: () => {
				throw new Error('Unexpected redirect');
			},
			notFound: () => {
				throw new Error('Unexpected 404');
			},
		});
		const page = Home(model);
		const html = await new Response(
			await renderToReadableStream((page.props as { children: ReactNode }).children),
		).text();
		assert.equal(model.verseExplanations.length, 1);
		assert.equal(model.verseExplanations[0]?.reference, 'Isaiah 41:10');
		assert.match(html, /href="\/verse\/isaiah\/41\/10"/);
		assert.match(html, /What Does Isaiah 41:10 Mean/);
		assert.ok(html.includes(model.verseExplanations[0]!.summary));
		assert.doesNotMatch(html, /Draft explanation must stay hidden|href="\/verse\/john\/1\/1"/);
		assert.equal(requests, 0);
	} finally {
		process.chdir(project);
		globalThis.fetch = oldFetch;
		if (oldKey === undefined) delete process.env.YVP_APP_KEY;
		else process.env.YVP_APP_KEY = oldKey;
		await rm(temp, { recursive: true, force: true });
	}
});
