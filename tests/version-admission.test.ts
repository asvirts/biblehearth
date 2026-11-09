import assert from 'node:assert/strict';
import test from 'node:test';
import type { BibleVersion } from '@youversion/platform-core';
import { BibleUnavailableError, resolveVersion } from '../src/lib/youversion/api';
import { DEFAULT_LOCALE, localeForCode } from '../src/lib/i18n/locales';

const version = (id: number, abbreviation = 'NIV'): BibleVersion =>
	({
		id,
		abbreviation,
		localized_abbreviation: abbreviation,
		title: 'Fixture Bible',
		localized_title: 'Fixture Bible',
		copyright: 'Fixture publisher notice',
	}) as BibleVersion;

function fixture(catalog = [version(111)]) {
	const detailCalls: number[] = [];
	const source = {
		listVersions: async () => catalog,
		getVersionById: async (id: number): Promise<BibleVersion | null> => {
			detailCalls.push(id);
			return version(id);
		},
		peekVersion: async (_id: number): Promise<BibleVersion | undefined> => undefined,
		defaultVersionId: 111,
	};
	return { source, detailCalls };
}

test('distinct unknown numeric IDs never reach the credentialed detail lookup', async () => {
	const { source, detailCalls } = fixture();
	for (const slug of [
		'niv-999001',
		'niv-999002',
		'niv-0',
		'niv-9007199254740992',
		`niv-${'9'.repeat(200)}`,
	]) {
		assert.equal(await resolveVersion(slug, DEFAULT_LOCALE, source), null);
	}
	assert.deepEqual(detailCalls, []);
});

test('localized allowlists reject unadmitted IDs before loading even the catalog', async () => {
	const { source, detailCalls } = fixture();
	source.listVersions = async () => {
		throw new Error('should not load catalog');
	};
	assert.equal(await resolveVersion('niv-111', localeForCode('pt')!, source), null);
	assert.deepEqual(detailCalls, []);
});

test('catalog-admitted aliases hydrate copyright and canonicalize normally', async () => {
	const { source, detailCalls } = fixture([version(111), version(999, 'NIV')]);
	const result = await resolveVersion('anything-111', DEFAULT_LOCALE, source);
	assert.equal(result?.slug, 'niv-111');
	assert.equal(result?.version.copyright, 'Fixture publisher notice');
	assert.deepEqual(detailCalls, [111]);
});

test('a catalog outage preserves configured and previously observed version fallbacks', async () => {
	const { source, detailCalls } = fixture();
	source.listVersions = async () => {
		throw new BibleUnavailableError();
	};
	assert.equal((await resolveVersion('niv-111', DEFAULT_LOCALE, source))?.version.id, 111);
	source.peekVersion = async (id) => (id === 222 ? version(222, 'KNOWN') : undefined);
	assert.equal((await resolveVersion('known-222', DEFAULT_LOCALE, source))?.version.id, 222);
	const pt = localeForCode('pt')!;
	assert.equal(
		(await resolveVersion(`nvi-${pt.defaultVersionId}`, pt, source))?.version.id,
		pt.defaultVersionId,
	);
	await assert.rejects(
		resolveVersion('unknown-999003', DEFAULT_LOCALE, source),
		BibleUnavailableError,
	);
	assert.deepEqual(detailCalls, [111, 222, pt.defaultVersionId]);
});

test('a listed version with unavailable details remains retryable, not an absent Bible', async () => {
	const { source } = fixture();
	source.getVersionById = async () => null;
	await assert.rejects(resolveVersion('niv-111', DEFAULT_LOCALE, source), BibleUnavailableError);
});
