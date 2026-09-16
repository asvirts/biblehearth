import assert from 'node:assert/strict';
import test from 'node:test';
import { clauseWithin, TITLE_MAX, titleWithClause } from './seo-title.ts';

test('clauseWithin keeps a punctuated clause that fits', () => {
	assert.equal(
		clauseWithin(
			'The Lord is my shepherd, I lack nothing. He makes me lie down in green pastures.',
			30,
		),
		'The Lord is my shepherd',
	);
});

test('clauseWithin falls back to whole words when there is no comma', () => {
	const verse =
		'For God so loved the world that he gave his one and only Son that whoever believes in him shall not perish';
	const snippet = clauseWithin(verse, 52);
	assert.match(snippet, /^For God so loved the world/);
	assert.ok(snippet.length <= 52);
	assert.doesNotMatch(snippet, /…/);
});

test('titleWithClause prefers the verse over the generic tail', () => {
	const title = titleWithClause(
		'John 3:16',
		'in 6 Translations',
		'For God so loved the world that he gave his one and only Son that whoever believes in him shall not perish',
		TITLE_MAX,
	);
	assert.match(title, /^John 3:16/);
	assert.match(title, /For God so loved the world/);
	assert.ok(title.length <= TITLE_MAX);
});
