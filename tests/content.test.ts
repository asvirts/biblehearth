import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToReadableStream } from 'react-dom/server';
import type { ReactNode } from 'react';
import superjson from 'superjson';

// Content tests must be deterministic and never spend Scripture API quota.
process.env.YVP_APP_KEY = '';

const { collections } = await import('../src/content.config');
const { getCollection, getEntries, render } = await import('../src/lib/content');
const { chapterBriefMarkdown, topicMarkdown, answerMarkdown, markdownResponse } =
	await import('../src/lib/markdown');
const { Home } = await import('../src/views/editorial/Home');
const { loadHome } = await import('../src/loaders/editorial/Home');
const { DEFAULT_LOCALE } = await import('../src/lib/i18n/locales');
const { DEGRADED_CACHE_CONTROL } = await import('../src/lib/http');

const site = new URL('https://biblehearth.online');

test('all authored collections validate and their topic references resolve', async () => {
	const [topics, answers, chapters] = await Promise.all([
		getCollection('topics'),
		getCollection('answers'),
		getCollection('chapters'),
	]);
	assert.ok(topics.length > 0 && answers.length > 0 && chapters.length > 0);
	const references = [
		...topics.flatMap((entry) => entry.data.related),
		...answers.flatMap((entry) => entry.data.relatedTopics),
		...chapters.flatMap((entry) => entry.data.relatedTopics),
	];
	assert.equal((await getEntries(references)).length, references.length);
	assert.equal(collections.topics.safeParse({ title: 'Too little data' }).success, false);
});

test('authored markdown renders and markdown twins do not fetch Scripture', async () => {
	const originalFetch = globalThis.fetch;
	let fetches = 0;
	globalThis.fetch = async () => {
		fetches++;
		throw new Error('Unexpected external request while rendering editorial markdown');
	};
	try {
		const [topics, answers, chapters] = await Promise.all([
			getCollection('topics'),
			getCollection('answers'),
			getCollection('chapters'),
		]);
		const topic = topics.find((entry) => entry.id === 'anxiety')!;
		const answer = answers.find((entry) => entry.id === 'nephilim-in-the-bible')!;
		const chapter = chapters.find((entry) => entry.id === 'psalms-23')!;
		assert.ok(topic && answer && chapter);
		const { Content } = await render(answer);
		const stream = await renderToReadableStream(Content());
		const html = await new Response(stream).text();
		assert.match(html, /Josephus/);
		assert.match(html, /<a href=/);
		for (const [body, excerpt] of [
			[await topicMarkdown(topic, site), topic.data.shortAnswer],
			[await answerMarkdown(answer, site), answer.data.shortAnswer],
			[await chapterBriefMarkdown(chapter, site), chapter.data.shortAnswer],
		] as const) {
			assert.ok(body.includes(excerpt.replace(/\s+/g, ' ').trim()));
			assert.match(body, /https:\/\/biblehearth\.online\/verse\//);
			assert.equal(markdownResponse(body).headers.get('X-Robots-Tag'), 'noindex');
		}
		assert.equal(fetches, 0);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('home keeps its original studies and navigation when Scripture is unavailable', async () => {
	const context = {
		site,
		url: new URL('/', site),
		params: {},
		locals: { locale: DEFAULT_LOCALE, localePath: '/' },
		request: new Request(site),
		response: { status: 200, headers: new Headers() },
		redirect: (): never => {
			throw new Error('Unexpected redirect');
		},
		notFound: (): never => {
			throw new Error('Unexpected 404');
		},
	};
	const data = await loadHome(context);
	const restored = superjson.parse<typeof data>(superjson.stringify(data));
	const page = Home(restored);
	const stream = await renderToReadableStream((page.props as { children: ReactNode }).children);
	const html = await new Response(stream).text();
	assert.equal(context.response.status, 200);
	assert.equal(context.response.headers.get('Cache-Control'), DEGRADED_CACHE_CONTROL);
	assert.match(html, /Read the Bible with help when you need it/);
	assert.match(html, /Chapter studies/);
	assert.match(html, /Questions people ask/);
	assert.match(html, /Scripture is temporarily unavailable/);
	assert.doesNotMatch(html, /YVP_APP_KEY|local environment|dev server/i);
});

test('editorial server data survives serialization with dates and maps intact', async () => {
	const { loadTopicDetail } = await import('../src/loaders/editorial/TopicDetail');
	const { TopicDetail } = await import('../src/views/editorial/TopicDetail');
	const context = {
		site,
		url: new URL('/topics/anxiety', site),
		params: { slug: 'anxiety' },
		locals: { locale: DEFAULT_LOCALE, localePath: '/topics/anxiety' },
		request: new Request(new URL('/topics/anxiety', site)),
		response: { status: 200, headers: new Headers() },
		redirect: (): never => {
			throw new Error('Unexpected redirect');
		},
		notFound: (): never => {
			throw new Error('Unexpected 404');
		},
	};
	const loaded = await loadTopicDetail(context);
	const restored = superjson.parse<typeof loaded>(superjson.stringify(loaded));
	assert.ok(restored.passages instanceof Map);
	assert.ok(restored.topic.data.reviewedAt instanceof Date);
	assert.equal(restored.title, loaded.title);
	const page = TopicDetail(restored);
	const stream = await renderToReadableStream((page.props as { children: ReactNode }).children);
	const html = await new Response(stream).text();
	assert.match(html, /Bible Verses About Anxiety/);
	assert.match(html, /Scripture is temporarily unavailable/);
	assert.equal(context.response.status, 200);
});

test('listing models retain visible summaries without embedding full articles', async () => {
	const { loadStudy } = await import('../src/loaders/editorial/Study');
	const { loadTopicsIndex } = await import('../src/loaders/editorial/TopicsIndex');
	const { loadAnswersIndex } = await import('../src/loaders/editorial/AnswersIndex');
	const { loadAbout } = await import('../src/loaders/editorial/About');
	const { listChapterBriefs } = await import('../src/lib/commentary');
	const { listTopics, topicVerseCount } = await import('../src/lib/topics');
	const { listAnswers } = await import('../src/lib/answers');
	const makeContext = (path: string) => ({
		site,
		url: new URL(path, site),
		params: {},
		locals: { locale: DEFAULT_LOCALE, localePath: path },
		request: new Request(new URL(path, site)),
		response: { status: 200, headers: new Headers() },
		redirect: (): never => {
			throw new Error('Unexpected redirect');
		},
		notFound: (): never => {
			throw new Error('Unexpected 404');
		},
	});
	const [fullBriefs, fullTopics, fullAnswers, study, topics, answers, about] = await Promise.all([
		listChapterBriefs(),
		listTopics(),
		listAnswers(),
		loadStudy(makeContext('/study')),
		loadTopicsIndex(makeContext('/topics')),
		loadAnswersIndex(makeContext('/answers')),
		loadAbout(makeContext('/about')),
	]);
	assert.deepEqual(
		study.briefs.map(({ id, title, usfm }) => ({ id, title, usfm })),
		fullBriefs.map(({ id, data }) => ({ id, title: data.title, usfm: data.usfm })),
	);
	assert.deepEqual(
		topics.topics.map(({ id, title, verseCount, groupCount }) => ({
			id,
			title,
			verseCount,
			groupCount,
		})),
		fullTopics.map((topic) => ({
			id: topic.id,
			title: topic.data.title,
			verseCount: topicVerseCount(topic),
			groupCount: topic.data.groups.length,
		})),
	);
	assert.deepEqual(
		answers.answers.map(({ id, question, passage, viewCount, faqCount }) => ({
			id,
			question,
			passage,
			viewCount,
			faqCount,
		})),
		fullAnswers.map(({ id, data }) => ({
			id,
			question: data.question,
			passage: data.anchor.passage,
			viewCount: data.views.length,
			faqCount: data.faqs.length,
		})),
	);
	assert.equal(about.topicCount, fullTopics.length);
	assert.equal(about.answerCount, fullAnswers.length);
	const bytes = (value: unknown) => Buffer.byteLength(superjson.stringify(value));
	assert.ok(bytes(study.briefs) < bytes(fullBriefs) / 4);
	assert.ok(bytes(topics.topics) < bytes(fullTopics) / 2);
	assert.ok(bytes(answers.answers) < bytes(fullAnswers) / 4);
});

test('home version summaries preserve localized titles and collision-safe links', async () => {
	const { homeFeaturedVersions } = await import('../src/loaders/editorial/Home');
	const catalog = [
		{
			id: 1,
			title: 'First English Bible',
			localized_title: 'Localized First',
			abbreviation: 'ABBR1',
			localized_abbreviation: 'NIV',
			info: 'not a card field',
		},
		{
			id: 2,
			title: 'Second English Bible',
			localized_title: '',
			abbreviation: 'ABBR2',
			localized_abbreviation: 'NIV',
		},
		{
			id: 3,
			title: 'Distinct Bible',
			localized_title: '',
			abbreviation: 'BSB',
			localized_abbreviation: '',
		},
	] as unknown as import('@youversion/platform-core').BibleVersion[];
	assert.deepEqual(homeFeaturedVersions(catalog), [
		{ id: 1, slug: 'niv-1', abbreviation: 'NIV', title: 'Localized First' },
		{ id: 2, slug: 'niv-2', abbreviation: 'NIV', title: 'Second English Bible' },
		{ id: 3, slug: 'bsb', abbreviation: 'BSB', title: 'Distinct Bible' },
	]);
});

test('detail pages keep their selected writing and send only summaries for related cards', async () => {
	const { loadTopicDetail } = await import('../src/loaders/editorial/TopicDetail');
	const { loadAnswerDetail } = await import('../src/loaders/editorial/AnswerDetail');
	const { listAnswers } = await import('../src/lib/answers');
	const makeContext = (path: string, slug: string) => ({
		site,
		url: new URL(path, site),
		params: { slug },
		locals: { locale: DEFAULT_LOCALE, localePath: path },
		request: new Request(new URL(path, site)),
		response: { status: 200, headers: new Headers() },
		redirect: (): never => {
			throw new Error('Unexpected redirect');
		},
		notFound: (): never => {
			throw new Error('Unexpected 404');
		},
	});
	const [topic, answer, authoredAnswers] = await Promise.all([
		loadTopicDetail(makeContext('/topics/anxiety', 'anxiety')),
		loadAnswerDetail(makeContext('/answers/nephilim-in-the-bible', 'nephilim-in-the-bible')),
		listAnswers(),
	]);
	const source = authoredAnswers.find((entry) => entry.id === answer.answer.id)!;
	assert.equal(answer.answer.body, source.body);
	assert.deepEqual(answer.answer.data, source.data);
	assert.deepEqual(
		answer.otherAnswers,
		authoredAnswers
			.filter((entry) => entry.id !== source.id)
			.map((entry) => ({ id: entry.id, data: { question: entry.data.question } })),
	);
	for (const related of [...topic.relatedTopics, ...answer.relatedTopics]) {
		assert.deepEqual(Object.keys(related.data), ['title']);
		assert.equal('body' in related, false);
	}
});
