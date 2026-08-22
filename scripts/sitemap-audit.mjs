#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const target = new URL(process.argv[2] ?? 'http://localhost:4321');
const locales = JSON.parse(
	await readFile(new URL('./data/locales.json', import.meta.url), 'utf8'),
);

const response = await fetch(new URL('/sitemap.xml', target));
if (!response.ok) {
	console.error(`${response.url} returned ${response.status}`);
	process.exit(1);
}

const xml = await response.text();
const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
	(match) => new URL(unescapeXml(match[1].trim())).pathname,
);
const localePaths = paths.filter((path) =>
	path.startsWith('/sitemap-locale/'),
);
const expected = locales.map(({ code }) => `/sitemap-locale/${code}.xml`);
const actualSet = new Set(localePaths);
const expectedSet = new Set(expected);
const missing = expected.filter((path) => !actualSet.has(path));
const unexpected = localePaths.filter((path) => !expectedSet.has(path));
const duplicates = localePaths.filter(
	(path, index) => localePaths.indexOf(path) !== index,
);

if (
	expectedSet.size !== locales.length ||
	missing.length > 0 ||
	unexpected.length > 0 ||
	duplicates.length > 0
) {
	console.error(
		JSON.stringify(
			{
				registeredLocales: locales.length,
				uniqueLocaleCodes: expectedSet.size,
				localeSitemaps: localePaths.length,
				missing,
				unexpected,
				duplicates: [...new Set(duplicates)],
			},
			null,
			2,
		),
	);
	process.exit(1);
}

console.log(
	`${localePaths.length}/${locales.length} registered locales are in the sitemap index.`,
);

function unescapeXml(value) {
	return value
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&apos;', "'")
		.replaceAll('&amp;', '&');
}
