/**
 * Download a hand-picked public-domain / CC image and inject `figure` frontmatter.
 *
 * Reads the catalogue below, fetches each file from Wikimedia Commons or the
 * Met Open Access API, writes a ~2000px JPEG under src/assets/editorial/,
 * and records the resolved licence in scripts/data/editorial-images.json.
 *
 * The catalogue is empty until a picture is chosen. Do not re-seed it with
 * a stock set.
 *
 * Usage: node scripts/download-editorial-images.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const UA =
	'BibleHearth/1.0 (https://biblehearth.online; hello@biblehearth.online)';
const MAX_EDGE = 2000;
const JPEG_QUALITY = 82;

const LICENSE_URL = {
	cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
	pd: 'https://creativecommons.org/publicdomain/mark/1.0/',
	'cc-by': 'https://creativecommons.org/licenses/by/4.0/',
	'cc-by-sa': 'https://creativecommons.org/licenses/by-sa/4.0/',
};

/** @typedef {'cc0' | 'pd' | 'cc-by' | 'cc-by-sa'} LicenseId */

/**
 * @param {string} raw
 * @returns {LicenseId | null}
 */
function mapLicense(raw) {
	const s = (raw || '').toLowerCase();
	if (!s) return null;
	if (s.includes('cc0') || s.includes('cc zero') || s.includes('creative commons zero')) {
		return 'cc0';
	}
	if (
		s.includes('public domain') ||
		s === 'pd' ||
		s.includes('pdm') ||
		s.includes('no restrictions')
	) {
		return 'pd';
	}
	if (s.includes('by-sa') || s.includes('by sa')) return 'cc-by-sa';
	if (s.includes('by-nc') || s.includes('nc-sa') || s.includes('nd')) return null;
	if (s.includes('cc-by') || s.includes('cc by') || s === 'cc by') return 'cc-by';
	return null;
}

async function api(url) {
	let lastError;
	for (let attempt = 0; attempt < 6; attempt += 1) {
		const res = await fetch(url, {
			headers: { 'User-Agent': UA, Accept: 'application/json' },
		});
		if (res.status === 429 || res.status === 503) {
			const wait = 4000 * 2 ** attempt;
			await new Promise((resolve) => setTimeout(resolve, wait));
			lastError = new Error(`${res.status} ${url}`);
			continue;
		}
		if (!res.ok) throw new Error(`${res.status} ${url}`);
		return res.json();
	}
	throw lastError;
}

async function commonsInfo(title) {
	const file = title.startsWith('File:') ? title : `File:${title}`;
	const url = new URL('https://commons.wikimedia.org/w/api.php');
	url.searchParams.set('action', 'query');
	url.searchParams.set('format', 'json');
	url.searchParams.set('prop', 'imageinfo');
	url.searchParams.set('iiprop', 'url|extmetadata|mime|size');
	url.searchParams.set('iiurlwidth', '1600');
	url.searchParams.set('titles', file);
	const data = await api(url);
	const page = Object.values(data.query.pages)[0];
	if (!page || page.missing || !page.imageinfo?.[0]) return null;
	const info = page.imageinfo[0];
	const meta = info.extmetadata || {};
	const val = (key) => meta[key]?.value?.replace(/<[^>]+>/g, '').trim() || '';
	const license = mapLicense(val('LicenseShortName') || val('UsageTerms') || val('License'));
	if (!license) {
		return { skip: val('LicenseShortName') || 'unknown licence' };
	}
	return {
		downloadUrl: info.thumburl || info.url,
		license,
		licenseUrl: LICENSE_URL[license],
		sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURI(page.title)}`,
		artist: val('Artist'),
		objectName: val('ObjectName') || page.title.replace(/^File:/, '').replace(/_/g, ' '),
		credit: val('Credit'),
	};
}

async function commonsSearch(query) {
	const url = new URL('https://commons.wikimedia.org/w/api.php');
	url.searchParams.set('action', 'query');
	url.searchParams.set('format', 'json');
	url.searchParams.set('list', 'search');
	url.searchParams.set('srnamespace', '6');
	url.searchParams.set('srlimit', '8');
	url.searchParams.set('srsearch', query);
	const data = await api(url);
	return (data.query.search || []).map((hit) => hit.title);
}

async function resolveCommons(titles, search) {
	const tried = [...titles];
	for (const title of titles) {
		const info = await commonsInfo(title);
		if (info?.downloadUrl) return info;
		if (info?.skip) console.warn(`  skip ${title}: ${info.skip}`);
	}
	if (search) {
		const hits = await commonsSearch(search);
		for (const title of hits) {
			if (tried.includes(title) || tried.includes(title.replace(/^File:/, ''))) continue;
			const info = await commonsInfo(title);
			if (info?.downloadUrl) {
				console.warn(`  search hit: ${title}`);
				return info;
			}
		}
	}
	return null;
}

async function resolveMet(id) {
	const data = await api(
		`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
	);
	if (!data.isPublicDomain || !data.primaryImage) return null;
	return {
		downloadUrl: data.primaryImage,
		license: 'cc0',
		licenseUrl: LICENSE_URL.cc0,
		sourceUrl: data.objectURL,
		artist: data.artistDisplayName || 'Unknown',
		objectName: data.title,
		credit: data.creditLine || 'The Metropolitan Museum of Art',
	};
}

async function downloadJpeg(url, dest) {
	let lastError;
	for (let attempt = 0; attempt < 6; attempt += 1) {
		const res = await fetch(url, { headers: { 'User-Agent': UA } });
		if (res.status === 429 || res.status === 503) {
			const wait = 5000 * 2 ** attempt;
			console.warn(`  ${res.status}, waiting ${wait / 1000}s`);
			await new Promise((resolve) => setTimeout(resolve, wait));
			lastError = new Error(`download ${res.status} ${url}`);
			continue;
		}
		if (!res.ok) throw new Error(`download ${res.status} ${url}`);
		const buffer = Buffer.from(await res.arrayBuffer());
		await mkdir(path.dirname(dest), { recursive: true });
		await sharp(buffer)
			.rotate()
			.resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
			.jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
			.toFile(dest);
		return;
	}
	throw lastError;
}

function yamlQuote(value) {
	return JSON.stringify(value);
}

function figureYaml(entry, relSrc) {
	const c = entry.credit;
	const lines = [
		'figure:',
		`  src: ${relSrc}`,
		`  alt: ${yamlQuote(entry.alt)}`,
		`  caption: ${yamlQuote(entry.caption)}`,
		`  kind: ${entry.kind}`,
		'  credit:',
		`    title: ${yamlQuote(c.title)}`,
		`    creator: ${yamlQuote(c.creator)}`,
	];
	if (c.date) lines.push(`    date: ${yamlQuote(c.date)}`);
	lines.push(
		`    holder: ${yamlQuote(c.holder)}`,
		`    license: ${c.license}`,
		`    licenseUrl: ${c.licenseUrl}`,
		`    sourceUrl: ${c.sourceUrl}`,
	);
	return lines.join('\n');
}

async function injectFrontmatter(mdPath, yaml) {
	let text = await readFile(mdPath, 'utf8');
	if (/^figure:/m.test(text)) {
		text = text.replace(/\nfigure:\n(?:[ \t].*\n)+/, `\n${yaml}\n`);
	} else if (/\npublishedAt:/.test(text)) {
		text = text.replace(/\npublishedAt:/, `\n${yaml}\npublishedAt:`);
	} else {
		throw new Error(`no publishedAt in ${mdPath}`);
	}
	await writeFile(mdPath, text);
}

function assertLengths(entry) {
	if (entry.alt.length < 20 || entry.alt.length > 180) {
		throw new Error(`${entry.id} alt is ${entry.alt.length} chars`);
	}
	if (entry.caption.length < 20 || entry.caption.length > 240) {
		throw new Error(`${entry.id} caption is ${entry.caption.length} chars`);
	}
}

/** @type {Array<Record<string, unknown>>} */
const CATALOG = [
	// Empty on purpose. The stock Wikimedia set was taken down so pictures
	// can be hand-picked later. Add an entry here when one is chosen.
];

function hubTs(entries) {
	const hubs = entries.filter((e) => String(e.id).startsWith('hubs/'));
	const imports = hubs
		.map((e) => {
			const key = String(e.id).slice('hubs/'.length);
			return `import ${key} from '../../assets/editorial/hubs/${key}.jpg';`;
		})
		.join('\n');
	const pages = {
		home: { path: '/', name: 'Home' },
		about: { path: '/about', name: 'About' },
		study: { path: '/study', name: 'Bible study' },
		topics: { path: '/topics', name: 'Topics' },
		answers: { path: '/answers', name: 'Answers' },
	};
	const objects = hubs
		.map((e) => {
			const key = String(e.id).slice('hubs/'.length);
			const c = e.credit;
			const date = c.date ? `\n\t\tdate: ${JSON.stringify(c.date)},` : '';
			return `\t${key}: {
		src: ${key},
		alt: ${JSON.stringify(e.alt)},
		caption: ${JSON.stringify(e.caption)},
		kind: ${JSON.stringify(e.kind)},
		credit: {
			title: ${JSON.stringify(c.title)},
			creator: ${JSON.stringify(c.creator)},${date}
			holder: ${JSON.stringify(c.holder)},
			license: ${JSON.stringify(c.license)},
			licenseUrl: ${JSON.stringify(c.licenseUrl)},
			sourceUrl: ${JSON.stringify(c.sourceUrl)},
		},
	}`;
		})
		.join(',\n');
	const pageConst = Object.entries(pages)
		.map(
			([key, value]) =>
				`\t${key}: { path: ${JSON.stringify(value.path)}, name: ${JSON.stringify(value.name)} }`,
		)
		.join(',\n');
	return `import type { EditorialFigure } from './types';
${imports}

export const HUB_PAGES = {
${pageConst},
} as const;

export type HubId = keyof typeof HUB_PAGES;

export const hubFigures: Partial<Record<HubId, EditorialFigure>> = {
${objects}
};
`;
}

async function main() {
	const resolved = [];
	let failed = 0;
	for (const entry of CATALOG) {
		assertLengths(entry);
		process.stdout.write(`${entry.id} … `);
		try {
			const dest = path.join(ROOT, entry.dest);
			const source = entry.met
				? await resolveMet(entry.met)
				: await resolveCommons(entry.commons || [], entry.search);
			if (!source) throw new Error('no allowed source');
			const already = await readFile(dest).then(
				() => true,
				() => false,
			);
			if (!already) {
				await downloadJpeg(source.downloadUrl, dest);
				await new Promise((resolve) => setTimeout(resolve, 1200));
			}
			entry.credit.license = source.license;
			entry.credit.licenseUrl = source.licenseUrl;
			entry.credit.sourceUrl = source.sourceUrl;
			if (entry.md) {
				const rel = path
					.relative(path.dirname(path.join(ROOT, entry.md)), dest)
					.replaceAll('\\', '/');
				await injectFrontmatter(path.join(ROOT, entry.md), figureYaml(entry, rel));
			}
			resolved.push({
				id: entry.id,
				dest: entry.dest,
				kind: entry.kind,
				source: entry.met
					? { type: 'met', id: entry.met }
					: { type: 'commons', title: entry.commons?.[0] },
				downloadUrl: source.downloadUrl,
				alt: entry.alt,
				caption: entry.caption,
				credit: entry.credit,
			});
			console.log(source.license);
		} catch (error) {
			failed += 1;
			console.log('FAIL');
			console.error(`  ${error instanceof Error ? error.message : error}`);
		}
	}

	await mkdir(path.join(ROOT, 'scripts/data'), { recursive: true });
	await writeFile(
		path.join(ROOT, 'scripts/data/editorial-images.json'),
		`${JSON.stringify({ downloaded: new Date().toISOString().slice(0, 10), images: resolved }, null, '\t')}\n`,
	);
	const hubsReady = CATALOG.filter(
		(e) => String(e.id).startsWith('hubs/') && e.credit.license,
	);
	if (hubsReady.length) {
		await writeFile(path.join(ROOT, 'src/lib/images/hubs.ts'), hubTs(hubsReady));
	}

	if (failed) {
		console.error(`\n${failed} of ${CATALOG.length} failed`);
		process.exit(1);
	}
	console.log(`\n${resolved.length} images`);
}

main();

