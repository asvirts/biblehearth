import assert from 'node:assert/strict';
import test from 'node:test';
import type { BibleVersion } from '@youversion/platform-core';
import {
	BibleUnavailableError,
	hydrateVersion,
	mergeVersionDetails,
} from '../src/lib/youversion/api';

const catalog = {
	id: 111,
	abbreviation: 'NIV11',
	localized_abbreviation: 'NIV',
	title: 'New International Version',
	localized_title: 'New International Version',
	copyright: null,
	info: null,
	publisher_url: null,
} as unknown as BibleVersion;
const detail = {
	...catalog,
	abbreviation: 'DIFFERENT',
	localized_abbreviation: 'OTHER',
	title: 'Different detail label',
	localized_title: 'Different localized detail label',
	copyright: 'Publisher copyright notice',
	info: 'Publisher information',
	publisher_url: 'https://publisher.example',
} as BibleVersion;

test('a catalog version receives publisher details while keeping its stable localized identity', async () => {
	const calls: number[] = [];
	const result = await hydrateVersion(catalog, async (id) => {
		calls.push(id);
		return detail;
	});
	assert.deepEqual(calls, [111]);
	assert.equal(result.copyright, 'Publisher copyright notice');
	assert.equal(result.info, 'Publisher information');
	assert.equal(result.publisher_url, 'https://publisher.example');
	assert.equal(result.abbreviation, 'NIV11');
	assert.equal(result.localized_abbreviation, 'NIV');
	assert.equal(result.title, 'New International Version');
	assert.equal(result.localized_title, 'New International Version');
});

test('missing, mismatched or failed details cannot masquerade as missing Scripture', async () => {
	await assert.rejects(
		hydrateVersion(catalog, async () => null),
		BibleUnavailableError,
	);
	assert.throws(() => mergeVersionDetails(catalog, { ...detail, id: 999 }), BibleUnavailableError);
	const outage = new Error('metadata temporarily unavailable');
	await assert.rejects(
		hydrateVersion(catalog, async () => {
			throw outage;
		}),
		(error) => error === outage,
	);
});

test('catalog attribution remains available when the detail omits it', () => {
	const result = mergeVersionDetails(
		{ ...catalog, copyright: 'Existing publisher notice' },
		{ ...detail, copyright: null },
	);
	assert.equal(result.copyright, 'Existing publisher notice');
});
