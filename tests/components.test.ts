import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BiblePassage, BibleVersion } from '@youversion/platform-core';
import type { IndexedBible } from '../src/lib/youversion/api';
import type { ChapterBrief } from '../src/lib/commentary';
import { pageMetadataElements } from '../src/components/PageLayout';
import ChapterBriefBody from '../src/components/ChapterBriefBody';
import ReaderToolbar from '../src/components/ReaderToolbar';

const version = {
	id: 111,
	abbreviation: 'NIV',
	localized_abbreviation: 'NIV',
	title: 'New International Version',
	copyright: 'Copyright Publisher',
	info: '',
	publisher_url: 'https://publisher.example/',
} as BibleVersion;

test('JSON-LD escapes script closers and decodes to the original data', () => {
	const original = {
		'@type': 'Article',
		description: '2 < 3 and </script><script>alert(1)</script>',
	};
	const shell = pageMetadataElements({ title: 'Test', description: 'Test', jsonLd: original });
	const children = React.Children.toArray(shell.props.children);
	const script = children.find((child) => React.isValidElement(child) && child.type === 'script');
	assert.ok(React.isValidElement(script));
	const html = renderToStaticMarkup(script);
	assert.doesNotMatch(html, /<script>alert/);
	const contents = html.match(/^<script type="application\/ld\+json">(.*)<\/script>$/s)?.[1];
	assert.ok(contents);
	assert.deepEqual(JSON.parse(contents), original);
});

test('metadata preserves localized identity, indexing policy, and verification', () => {
	const metadata = pageMetadataElements(
		{
			title: 'Salmo 91',
			description: 'Leia e estude.',
			canonicalPath: '/pt/salmo/91',
			lang: 'pt',
			noindex: true,
			markdown: true,
			ogType: 'article',
			publishedTime: '2026-08-21T00:00:00.000Z' as unknown as Date,
			alternates: [
				{ hreflang: 'en', href: '/psalms/91' },
				{ hreflang: 'pt', href: '/pt/salmo/91' },
			],
		},
		{ bing: 'bing-tag', google: 'google-tag' },
	);
	const html = renderToStaticMarkup(metadata);
	assert.match(html, /<title>Salmo 91<\/title>/);
	assert.match(html, /name="robots" content="noindex, follow"/);
	assert.match(html, /rel="canonical" href="https:\/\/biblehearth\.online\/pt\/salmo\/91"/);
	assert.match(html, /hrefLang="x-default" href="https:\/\/biblehearth\.online\/psalms\/91"/i);
	assert.match(
		html,
		/type="text\/markdown" href="https:\/\/biblehearth\.online\/pt\/salmo\/91\.md"/,
	);
	assert.match(html, /property="article:published_time" content="2026-08-21T00:00:00\.000Z"/);
	assert.match(html, /name="msvalidate\.01" content="bing-tag"/);
	assert.match(html, /name="google-site-verification" content="google-tag"/);
});

const brief = {
	id: 'john-1',
	data: {
		usfm: 'JHN.1',
		shortAnswer: 'The opening of John.',
		outline: [],
		themes: [],
		glossary: [],
		keyVerses: [{ usfm: 'JHN.1.14', why: 'The Word became flesh.' }],
		faqs: [],
	},
} as unknown as ChapterBrief;
const passage = { content: '<p>Publisher scripture text</p>' } as BiblePassage;
const props = {
	brief,
	passages: new Map([['JHN.1.14', passage]]),
	reference: 'John 1',
	relatedTopics: [],
	firstSourceAnchor: null,
	version,
};

test('key verses keep publisher attribution when full chapter text is unavailable', () => {
	const html = renderToStaticMarkup(
		React.createElement(ChapterBriefBody, { ...props, hasFullText: false }),
	);
	assert.match(html, /Publisher scripture text/);
	assert.match(html, /Copyright Publisher/);
	assert.match(html, /publisher\.example/);
});

test('key verses do not add an empty or duplicate publisher notice', () => {
	const missing = renderToStaticMarkup(
		React.createElement(ChapterBriefBody, {
			...props,
			passages: new Map([['JHN.1.14', null]]),
			hasFullText: false,
		}),
	);
	assert.doesNotMatch(missing, /Copyright Publisher/);
	const fullChapter = renderToStaticMarkup(
		React.createElement(ChapterBriefBody, {
			...props,
			hasFullText: true,
			children: React.createElement('section', null, 'Chapter text', ' Copyright Publisher'),
		}),
	);
	assert.equal((fullChapter.match(/Copyright Publisher/g) ?? []).length, 1);
});

test('reader toolbar submits the current version, book, and chapter', () => {
	const index = {
		books: [
			{
				id: 'JHN',
				title: 'John',
				chapters: [
					{ id: '1', title: '1' },
					{ id: '2', title: '2' },
				],
			},
		],
	} as unknown as IndexedBible;
	const html = renderToStaticMarkup(
		React.createElement(ReaderToolbar, {
			catalog: [version],
			version,
			index,
			bookId: 'JHN',
			chapterId: '2',
		}),
	);
	assert.match(html, /<form[^>]*action="\/read"[^>]*>/);
	assert.match(html, /<option value="niv" selected="">/);
	assert.match(html, /<option value="john" selected="">/);
	assert.match(html, /<option value="2" selected="">/);
});
