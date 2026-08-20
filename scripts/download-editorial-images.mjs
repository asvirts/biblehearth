/**
 * Download public-domain / CC museum images and inject `figure` frontmatter.
 *
 * Reads the catalogue below, fetches each file from Wikimedia Commons or the
 * Met Open Access API, writes a ~2000px JPEG under src/assets/editorial/,
 * and records the resolved licence in scripts/data/editorial-images.json.
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
	// Hubs
	{
		id: 'hubs/home',
		dest: 'src/assets/editorial/hubs/home.jpg',
		kind: 'photograph',
		commons: [
			'Open fire in hearth grate at The Black Horse Inn, Nuthurst, West Sussex.jpg',
		],
		search: 'open fire hearth fireplace',
		alt: 'Logs burning in an open brick hearth, the fire lighting the grate from within.',
		caption: 'A hearth is the oldest picture of a house that is warm enough to sit still in — which is the kind of reading this site is for.',
		credit: {
			title: 'Open fire in a hearth grate',
			creator: 'Simon Carey',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'hubs/about',
		dest: 'src/assets/editorial/hubs/about.jpg',
		kind: 'photograph',
		commons: ['Codex Sinaiticus.jpg'],
		search: 'Codex Sinaiticus manuscript',
		alt: 'A sheet of the Codex Sinaiticus, four columns of Greek uncial script on parchment.',
		caption: 'The writing on this site is new. The text it is about is not: a fourth-century copy of the Greek Bible, still readable.',
		credit: {
			title: 'Codex Sinaiticus',
			creator: 'Unknown scribes',
			date: 'c. 330–360',
			holder: 'British Library',
		},
	},
	{
		id: 'hubs/study',
		dest: 'src/assets/editorial/hubs/study.jpg',
		kind: 'photograph',
		commons: [
			'Long Room Interior, Trinity College Dublin, Ireland - Diliff.jpg',
		],
		search: 'Long Room Trinity College Dublin library',
		alt: 'The Long Room of Trinity College Dublin, a barrel-vaulted gallery of old books in two storeys.',
		caption: 'A room built to keep books in reach of anyone who walks in — the same job a chapter study page is trying to do.',
		credit: {
			title: 'The Long Room, Trinity College Dublin',
			creator: 'David Iliff',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'hubs/topics',
		dest: 'src/assets/editorial/hubs/topics.jpg',
		kind: 'photograph',
		commons: [
			'Gutenberg Bible, Lenox Copy, New York Public Library, 2009. Pic 01.jpg',
			'Gutenberg Bible, New York Public Library, USA. Pic 01.jpg',
		],
		search: 'Gutenberg Bible New York Public Library',
		alt: 'An open spread of a Gutenberg Bible, blackletter columns on cream paper in a library case.',
		caption: 'Topics on this site are not a verse index. They are an argument, the way a printed Bible is an argument bound in order.',
		credit: {
			title: 'Gutenberg Bible, Lenox Copy',
			creator: 'Johannes Gutenberg',
			date: 'c. 1455',
			holder: 'New York Public Library',
		},
	},
	{
		id: 'hubs/answers',
		dest: 'src/assets/editorial/hubs/answers.jpg',
		kind: 'photograph',
		commons: [
			'Epistolae Pauli cum glossa ordinaria. - btv1b8426047w (226 of 395).jpg',
		],
		search: 'glossa ordinaria manuscript Paul',
		alt: 'A medieval manuscript of Paul with the biblical text in a centre column and commentary packed into the margins.',
		caption: 'Hard questions have always been answered in the margins of the passage, not instead of it.',
		credit: {
			title: 'Pauline epistles with the Glossa ordinaria',
			creator: 'Unknown scribes',
			date: '12th century',
			holder: 'Bibliothèque nationale de France',
		},
	},

	// Chapters
	{
		id: 'chapters/genesis-1',
		dest: 'src/assets/editorial/chapters/genesis-1.jpg',
		md: 'src/content/chapters/genesis-1.md',
		kind: 'art',
		commons: ['Michelangelo - Creation of Adam (cropped).jpg'],
		search: 'Michelangelo Creation of Adam Sistine',
		alt: 'Michelangelo’s Creation of Adam: two hands reaching across a gap, almost touching.',
		caption: 'The chapter’s claim in one gesture: people are made, on purpose, and the gap between maker and made does not close itself.',
		credit: {
			title: 'The Creation of Adam',
			creator: 'Michelangelo',
			date: 'c. 1512',
			holder: 'Sistine Chapel, Vatican',
		},
	},
	{
		id: 'chapters/genesis-6',
		dest: 'src/assets/editorial/chapters/genesis-6.jpg',
		md: 'src/content/chapters/genesis-6.md',
		kind: 'art',
		commons: ['John Martin - The Deluge - Google Art Project.jpg'],
		search: 'John Martin The Deluge',
		alt: 'John Martin’s The Deluge: a dark sky over heaving water, tiny figures clinging to rock.',
		caption: 'Genesis 6 is not a children’s-ark picture. Martin painted the water as something that unmakes a world.',
		credit: {
			title: 'The Deluge',
			creator: 'John Martin',
			date: '1834',
			holder: 'Yale Center for British Art',
		},
	},
	{
		id: 'chapters/psalms-23',
		dest: 'src/assets/editorial/chapters/psalms-23.jpg',
		md: 'src/content/chapters/psalms-23.md',
		kind: 'art',
		commons: [
			'"The good Shepherd" mosaic - Mausoleum of Galla Placidia.jpg',
			'Good Shepherd Galla Placidia in Ravenna.jpg',
		],
		search: 'Good Shepherd mosaic Galla Placidia Ravenna',
		alt: 'A fifth-century mosaic of a young shepherd in a gold landscape, sheep at his feet, a cross-staff in his hand.',
		caption: 'Christians put Psalm 23 on the walls of tombs: not a rural postcard, but a claim that the shepherd does not leave the valley.',
		credit: {
			title: 'The Good Shepherd',
			creator: 'Unknown mosaicists',
			date: 'c. 425',
			holder: 'Mausoleum of Galla Placidia, Ravenna',
		},
	},
	{
		id: 'chapters/psalms-27',
		dest: 'src/assets/editorial/chapters/psalms-27.jpg',
		md: 'src/content/chapters/psalms-27.md',
		kind: 'photograph',
		commons: ['Late Winter Sunrise on Lake Okanagan.JPG'],
		search: 'sunrise over calm lake',
		alt: 'Pale winter sunrise reflecting on a still lake, light coming up behind dark hills.',
		caption: '“The Lord is my light” is not a metaphor for cheerfulness. It is a claim that the dark does not get the last word.',
		credit: {
			title: 'Late winter sunrise on Lake Okanagan',
			creator: 'Wing-Chi Poon',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'chapters/psalms-28',
		dest: 'src/assets/editorial/chapters/psalms-28.jpg',
		md: 'src/content/chapters/psalms-28.md',
		kind: 'photograph',
		commons: ['Judean desert004.jpg'],
		search: 'Judean desert rock wilderness',
		alt: 'Bare limestone hills of the Judean desert under a hard sky, no green in sight.',
		caption: 'Psalm 28 calls God a rock while the poet is still shouting into silence. The landscape here is the kind of place that makes that prayer make sense.',
		credit: {
			title: 'The Judean desert',
			creator: 'David Shankbone',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'chapters/psalms-34',
		dest: 'src/assets/editorial/chapters/psalms-34.jpg',
		md: 'src/content/chapters/psalms-34.md',
		kind: 'art',
		commons: [
			'Luttichuys, Isaac - Still Life with Bread and Wine Glass - 17th c.jpg',
		],
		search: 'still life bread wine 17th century',
		alt: 'A seventeenth-century still life: a loaf of bread, a glass of wine, and a knife on a wooden table.',
		caption: '“Taste and see” is an invitation to something as ordinary as bread, not a slogan about positive thinking.',
		credit: {
			title: 'Still Life with Bread and Wine Glass',
			creator: 'Isaac Luttichuys',
			date: '17th century',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'chapters/psalms-46',
		dest: 'src/assets/editorial/chapters/psalms-46.jpg',
		md: 'src/content/chapters/psalms-46.md',
		kind: 'photograph',
		commons: ['Dülmen, Umland, Sonnenaufgang -- 2012 -- 8084.jpg'],
		search: 'river landscape sunrise',
		alt: 'A river winding through fields at sunrise, mist lying low along the water.',
		caption: 'The psalm’s river is not scenery. It is the thing that keeps a city alive while the rest of the earth is giving way.',
		credit: {
			title: 'Sunrise over the countryside, Dülmen',
			creator: 'Dietmar Rabich',
			date: '2012',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'chapters/psalms-51',
		dest: 'src/assets/editorial/chapters/psalms-51.jpg',
		md: 'src/content/chapters/psalms-51.md',
		kind: 'art',
		commons: ['Schnorr von Carolsfeld Bibel in Bildern 1860 102.png'],
		search: 'Nathan rebukes David Schnorr',
		alt: 'A woodcut of the prophet Nathan confronting King David, who covers his face.',
		caption: 'Psalm 51 is what David says after Nathan has said “You are the man.” The engraving keeps that order: first the charge, then the prayer.',
		credit: {
			title: 'Nathan rebukes David',
			creator: 'Julius Schnorr von Carolsfeld',
			date: '1860',
			holder: 'Die Bibel in Bildern',
		},
	},
	{
		id: 'chapters/psalms-91',
		dest: 'src/assets/editorial/chapters/psalms-91.jpg',
		md: 'src/content/chapters/psalms-91.md',
		kind: 'photograph',
		commons: ['ISR-2016-Masada 04.jpg', 'Israel-2013-Aerial 21-Masada.jpg'],
		search: 'Masada fortress Israel',
		alt: 'The rock fortress of Masada seen from below, a flat-topped crag above the desert.',
		caption: 'Psalm 91 talks about shelter the way a fortress talks about it: not that danger is imaginary, but that there is a place it does not own.',
		credit: {
			title: 'Masada',
			creator: 'Godot13',
			date: '2016',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'chapters/psalms-121',
		dest: 'src/assets/editorial/chapters/psalms-121.jpg',
		md: 'src/content/chapters/psalms-121.md',
		kind: 'photograph',
		commons: ['Mount Hermon View.jpg'],
		search: 'Mount Hermon view mountains',
		alt: 'Snow-capped Mount Hermon rising over a wide valley, hills receding into haze.',
		caption: '“I lift up my eyes to the hills” is the start of a question, not a nature lyric: the help does not come from the hills themselves.',
		credit: {
			title: 'Mount Hermon',
			creator: 'Almog',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'chapters/psalms-139',
		dest: 'src/assets/editorial/chapters/psalms-139.jpg',
		md: 'src/content/chapters/psalms-139.md',
		kind: 'photograph',
		commons: ['ALMA and a Starry Night.jpg'],
		search: 'starry night sky milky way ESO',
		alt: 'The Milky Way over the ALMA antennas on a high plateau, the sky dense with stars.',
		caption: 'Psalm 139’s night is not empty. It is the place the psalmist says you still cannot hide.',
		credit: {
			title: 'ALMA and a starry night',
			creator: 'European Southern Observatory / Babak Tafreshi',
			holder: 'ESO',
		},
	},
	{
		id: 'chapters/matthew-5',
		dest: 'src/assets/editorial/chapters/matthew-5.jpg',
		md: 'src/content/chapters/matthew-5.md',
		kind: 'art',
		commons: ['Bloch-SermonOnTheMount.jpg'],
		search: 'Bloch Sermon on the Mount',
		alt: 'Carl Bloch’s Sermon on the Mount: Jesus seated on a hillside, a crowd gathered on the grass below him.',
		caption: 'Matthew 5 is a sermon delivered to people sitting on a hill, not a poster of virtues. Bloch painted the crowd as well as the speaker.',
		credit: {
			title: 'Sermon on the Mount',
			creator: 'Carl Bloch',
			date: '1877',
			holder: 'Museum of National History, Frederiksborg',
		},
	},
	{
		id: 'chapters/matthew-6',
		dest: 'src/assets/editorial/chapters/matthew-6.jpg',
		md: 'src/content/chapters/matthew-6.md',
		kind: 'photograph',
		commons: ['Lilium candidum in Wadi Kelah 1.jpg', 'Lilium candidum MHNT.BOT.2011.18.27.jpg'],
		search: 'Lilium candidum Madonna lily',
		alt: 'White Madonna lilies growing on a rocky slope, trumpets open toward the light.',
		caption: '“Consider the lilies” is an argument about anxiety, made from a flower that does not farm and is still dressed.',
		credit: {
			title: 'Madonna lily (Lilium candidum)',
			creator: 'Ori~',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'chapters/john-3',
		dest: 'src/assets/editorial/chapters/john-3.jpg',
		md: 'src/content/chapters/john-3.md',
		kind: 'art',
		commons: ['Henry Ossawa Tanner - Nicodemus coming to Christ.jpg'],
		search: 'Tanner Nicodemus visiting Jesus',
		alt: 'Henry Ossawa Tanner’s Nicodemus visiting Jesus at night, two figures in a dim courtyard, a lantern between them.',
		caption: 'John 3 happens after dark, on purpose. Tanner painted the lantern, not a spotlight: this is a conversation a Pharisee would rather not have in public.',
		credit: {
			title: 'Nicodemus Coming to Christ',
			creator: 'Henry Ossawa Tanner',
			date: '1927',
			holder: 'Philadelphia Museum of Art',
		},
	},
	{
		id: 'chapters/john-14',
		dest: 'src/assets/editorial/chapters/john-14.jpg',
		md: 'src/content/chapters/john-14.md',
		kind: 'art',
		commons: [
			'Leonardo da Vinci (1452-1519) - The Last Supper (1495-1498).jpg',
		],
		search: 'Leonardo Last Supper',
		alt: 'Leonardo’s Last Supper: Jesus at the centre of a long table, the disciples reacting around him.',
		caption: 'John 14 is spoken at this table, after the meal has already turned. The room is the point: “In my Father’s house” is said by someone about to leave it.',
		credit: {
			title: 'The Last Supper',
			creator: 'Leonardo da Vinci',
			date: 'c. 1495–1498',
			holder: 'Santa Maria delle Grazie, Milan',
		},
	},
	{
		id: 'chapters/joshua-1',
		dest: 'src/assets/editorial/chapters/joshua-1.jpg',
		md: 'src/content/chapters/joshua-1.md',
		kind: 'art',
		commons: [
			'John Martin - Joshua Commanding the Sun to Stand Still - Google Art Project.jpg',
		],
		search: 'John Martin Joshua Commanding the Sun',
		alt: 'John Martin’s Joshua commanding the sun: a vast army under a sky split by light, the sun halted above the field.',
		caption: 'Joshua 1 is the charge before any of that happens: be strong, because the work in front of you is larger than you.',
		credit: {
			title: 'Joshua Commanding the Sun to Stand Still',
			creator: 'John Martin',
			date: '1840',
			holder: 'National Gallery of Art, Washington',
		},
	},
	{
		id: 'chapters/jeremiah-29',
		dest: 'src/assets/editorial/chapters/jeremiah-29.jpg',
		md: 'src/content/chapters/jeremiah-29.md',
		kind: 'photograph',
		commons: ['Ishtar Gate at Berlin Museum.jpg', 'Ishtar-gate-بوابة-عشتار.jpg'],
		search: 'Ishtar Gate Babylon Berlin',
		alt: 'The reconstructed Ishtar Gate: glazed blue brick, bulls and dragons in relief, under a museum roof.',
		caption: 'Jeremiah 29 is a letter to people living under this kind of power, told to unpack and plant gardens rather than wait for a quick rescue.',
		credit: {
			title: 'The Ishtar Gate of Babylon',
			creator: 'Unknown Babylonian craftsmen',
			date: 'c. 575 BCE',
			holder: 'Pergamon Museum, Berlin',
		},
	},
	{
		id: 'chapters/isaiah-41',
		dest: 'src/assets/editorial/chapters/isaiah-41.jpg',
		md: 'src/content/chapters/isaiah-41.md',
		kind: 'photograph',
		commons: [
			'Aerial view of the Judean Desert (near Masada), Israel 03.jpg',
		],
		search: 'aerial Judean Desert',
		alt: 'An aerial view of the Judean desert: ridged limestone, dry wadis, almost no vegetation.',
		caption: 'Isaiah 41 promises rivers on this kind of ground. The promise is only as large as the dryness it names.',
		credit: {
			title: 'The Judean desert near Masada',
			creator: 'Andrew Shiva',
			date: '2013',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'chapters/hebrews-11',
		dest: 'src/assets/editorial/chapters/hebrews-11.jpg',
		md: 'src/content/chapters/hebrews-11.md',
		kind: 'art',
		commons: ['Molnár Ábrahám kiköltözése 1850.jpg'],
		search: 'Molnar Abraham journeying Canaan',
		alt: 'József Molnár’s painting of Abraham’s household on the move: tents, camels, and a long road under a wide sky.',
		caption: 'Hebrews 11 is a list of people who left before they arrived. Abraham is first in that line because he packed while the destination was still only a promise.',
		credit: {
			title: 'Abraham’s Journey',
			creator: 'József Molnár',
			date: '1850',
			holder: 'Hungarian National Gallery',
		},
	},
	{
		id: 'chapters/james-1',
		dest: 'src/assets/editorial/chapters/james-1.jpg',
		md: 'src/content/chapters/james-1.md',
		kind: 'photograph',
		met: 255391,
		alt: 'A Greek bronze mirror of the fifth century BCE, the disc held up by a small draped figure.',
		caption: 'James says a person who hears the word and does not do it is like someone who looks in a mirror and walks away having forgotten the face.',
		credit: {
			title: 'Bronze mirror with a support in the form of a draped woman',
			creator: 'Unknown Greek bronzeworker',
			date: 'mid-5th century BCE',
			holder: 'The Metropolitan Museum of Art',
		},
	},
	{
		id: 'chapters/revelation-21',
		dest: 'src/assets/editorial/chapters/revelation-21.jpg',
		md: 'src/content/chapters/revelation-21.md',
		kind: 'art',
		commons: ['John Martin - The Plains of Heaven - Google Art Project.jpg'],
		search: 'John Martin The Plains of Heaven',
		alt: 'John Martin’s Plains of Heaven: a luminous lake and distant mountains under a vast, crowded sky.',
		caption: 'Revelation 21 is not an escape from earth. Martin painted a world, not a cloud: the claim is that the holy city comes down.',
		credit: {
			title: 'The Plains of Heaven',
			creator: 'John Martin',
			date: '1851–1853',
			holder: 'Tate Britain',
		},
	},
	{
		id: 'chapters/romans-8',
		dest: 'src/assets/editorial/chapters/romans-8.jpg',
		md: 'src/content/chapters/romans-8.md',
		kind: 'photograph',
		commons: ['Оld Olive trees in the Garden of Gethsemane, 05.jpg'],
		search: 'old olive trees Garden of Gethsemane',
		alt: 'Ancient olive trees in Gethsemane, thick twisted trunks and silver leaves against stone.',
		caption: 'Romans 8 is about a life the Spirit keeps going. Olive trees of this age are the nearest plant-picture of that: still alive after more winters than anyone present remembers.',
		credit: {
			title: 'Old olive trees in the Garden of Gethsemane',
			creator: 'Kristián Slovák',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'chapters/romans-12',
		dest: 'src/assets/editorial/chapters/romans-12.jpg',
		md: 'src/content/chapters/romans-12.md',
		kind: 'photograph',
		commons: ['P46.jpg'],
		search: 'Papyrus 46 Paul',
		alt: 'A leaf of Papyrus 46, early Greek text of Paul written in a compact book hand.',
		caption: 'Romans 12 is “therefore”: after eleven chapters of argument, the letter turns to what a body of people is for. This is an early copy of that turn.',
		credit: {
			title: 'Papyrus 46',
			creator: 'Unknown scribe',
			date: 'c. 175–225',
			holder: 'University of Michigan / Chester Beatty Library',
		},
	},
	{
		id: 'chapters/1-corinthians-13',
		dest: 'src/assets/editorial/chapters/1-corinthians-13.jpg',
		md: 'src/content/chapters/1-corinthians-13.md',
		kind: 'art',
		commons: ['Van Dyck - Charity.jpg', 'Antoon van dyck, carità, 1627-28 ca.jpg'],
		search: 'van Dyck Charity Caritas',
		alt: 'Van Dyck’s Charity: a woman gathering children against her, a picture of caritas rather than romance.',
		caption: 'Paul’s “love” in this chapter is caritas — the kind that stays when the gifts run out — not the feeling a wedding reading usually means.',
		credit: {
			title: 'Charity',
			creator: 'Anthony van Dyck',
			date: 'c. 1627–1628',
			holder: 'National Gallery, London',
		},
	},
	{
		id: 'chapters/ecclesiastes-3',
		dest: 'src/assets/editorial/chapters/ecclesiastes-3.jpg',
		md: 'src/content/chapters/ecclesiastes-3.md',
		kind: 'photograph',
		commons: ['Winter in Trossachs, Scotland.jpg'],
		search: 'winter landscape bare trees snow',
		alt: 'A winter valley in the Trossachs: bare trees, snow on the hills, a season that has clearly arrived.',
		caption: 'Ecclesiastes 3 does not say every season is pleasant. It says each one has a time, including the ones that look like nothing is growing.',
		credit: {
			title: 'Winter in the Trossachs',
			creator: 'Wfscraig',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'chapters/ephesians-6',
		dest: 'src/assets/editorial/chapters/ephesians-6.jpg',
		md: 'src/content/chapters/ephesians-6.md',
		kind: 'photograph',
		met: 247983,
		alt: 'A bronze Corinthian helmet, the face-opening a dark T in a surface that once took blows.',
		caption: 'Ephesians 6 borrows armour because the letter thinks the Christian life is a fight. The pieces named are real pieces, not a costume.',
		credit: {
			title: 'Bronze helmet of the Corinthian type',
			creator: 'Unknown Greek bronzeworker',
			date: 'early 5th century BCE',
			holder: 'The Metropolitan Museum of Art',
		},
	},
	{
		id: 'chapters/galatians-5',
		dest: 'src/assets/editorial/chapters/galatians-5.jpg',
		md: 'src/content/chapters/galatians-5.md',
		kind: 'art',
		commons: [
			'Banquet Still Life, Adriaen van Utrecht, 1644 - Rijksmuseum.jpg',
		],
		search: 'Adriaen van Utrecht Banquet Still Life fruit',
		alt: 'A piled still life of fruit, bread, and game, painted as abundance that will not last.',
		caption: 'The fruit of the Spirit is not a still life. Van Utrecht’s table shows what fruit looks like when it is only produce: impressive, and already on the way to rotting.',
		credit: {
			title: 'Banquet Still Life',
			creator: 'Adriaen van Utrecht',
			date: '1644',
			holder: 'Rijksmuseum',
		},
	},
	{
		id: 'chapters/philippians-4',
		dest: 'src/assets/editorial/chapters/philippians-4.jpg',
		md: 'src/content/chapters/philippians-4.md',
		kind: 'art',
		commons: ['The Apostle Paul - Rembrandt.jpg', 'Rembrandt - Apostle Paul - WGA19120.jpg'],
		search: 'Rembrandt Apostle Paul',
		alt: 'Rembrandt’s Apostle Paul: an old man in a dark room, a manuscript on the table, light on his face.',
		caption: 'Philippians 4’s “do not be anxious” is written from confinement. Rembrandt painted Paul with the letter, not with a halo.',
		credit: {
			title: 'The Apostle Paul',
			creator: 'Rembrandt',
			date: 'c. 1657',
			holder: 'National Gallery of Art, Washington',
		},
	},
	{
		id: 'chapters/proverbs-3',
		dest: 'src/assets/editorial/chapters/proverbs-3.jpg',
		md: 'src/content/chapters/proverbs-3.md',
		kind: 'photograph',
		commons: ['Aleppo Codex (Deut).jpg'],
		search: 'Aleppo Codex manuscript',
		alt: 'A page of the Aleppo Codex, Hebrew written in a precise masoretic hand with vowel points.',
		caption: 'Proverbs 3 is wisdom meant to be copied, not invented on the spot. This is what that kind of copying looked like when it was done with care.',
		credit: {
			title: 'Aleppo Codex',
			creator: 'Masoretic scribes',
			date: 'c. 920',
			holder: 'Israel Museum / Ben-Zvi Institute',
		},
	},
	{
		id: 'chapters/proverbs-31',
		dest: 'src/assets/editorial/chapters/proverbs-31.jpg',
		md: 'src/content/chapters/proverbs-31.md',
		kind: 'photograph',
		commons: ['Field of Flax - geograph.org.uk - 282010.jpg'],
		search: 'flax field flowers',
		alt: 'A field of blue flax in flower, low plants stretching to a hedge under an ordinary sky.',
		caption: 'Proverbs 31’s woman works in flax and wool. The chapter is about skill and provision, not a personality type, and flax is the plant it names.',
		credit: {
			title: 'Field of flax',
			creator: 'Roger Jones',
			holder: 'Geograph Britain and Ireland',
		},
	},

	// Topics
	{
		id: 'topics/anxiety',
		dest: 'src/assets/editorial/topics/anxiety.jpg',
		md: 'src/content/topics/anxiety.md',
		kind: 'art',
		commons: ['Ivan Aivazovsky - Ship in the Stormy Sea.jpg'],
		search: 'Aivazovsky stormy sea',
		alt: 'An Aivazovsky seascape: a small ship heeled over in a heavy sea under a torn sky.',
		caption: 'The Bible’s anxiety passages are written for weather like this, not for a calm that has already arrived.',
		credit: {
			title: 'Ship in the Stormy Sea',
			creator: 'Ivan Aivazovsky',
			date: '1887',
			holder: 'Aivazovsky National Art Museum, Feodosia',
		},
	},
	{
		id: 'topics/depression',
		dest: 'src/assets/editorial/topics/depression.jpg',
		md: 'src/content/topics/depression.md',
		kind: 'art',
		commons: [
			'Caspar David Friedrich Paysage de Riesengebirge avec la brume montante.jpg',
		],
		search: 'Caspar David Friedrich mist mountains landscape',
		alt: 'A Friedrich landscape: distant ridges fading into rising mist, no figure in the foreground.',
		caption: 'Some psalms sound like this weather — not theatrical despair, just a view in which the path is hard to see.',
		credit: {
			title: 'Mountain Landscape with Rising Mist',
			creator: 'Caspar David Friedrich',
			date: 'c. 1810–1820',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/fear',
		dest: 'src/assets/editorial/topics/fear.jpg',
		md: 'src/content/topics/fear.md',
		kind: 'photograph',
		commons: [
			'Port and lighthouse overnight storm with lightning in Port-la-Nouvelle.jpg',
		],
		search: 'lightning storm night sea',
		alt: 'Lightning striking over a harbour at night, a lighthouse and the water lit for an instant.',
		caption: 'Fear in Scripture is often this sudden: a sky that was weather and is now a threat. The verses about it do not pretend the storm is imaginary.',
		credit: {
			title: 'Overnight storm with lightning, Port-la-Nouvelle',
			creator: 'Maxime Raynal',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/peace',
		dest: 'src/assets/editorial/topics/peace.jpg',
		md: 'src/content/topics/peace.md',
		kind: 'photograph',
		commons: ['Calm waters, Sea of Galilee 0833 (508209962).jpg'],
		search: 'calm Sea of Galilee',
		alt: 'The Sea of Galilee on a still day, pale hills across a barely ruffled surface.',
		caption: 'Biblical peace is not the absence of a lake that can storm. It is what is said to hold when the water has a history of not staying like this.',
		credit: {
			title: 'Calm waters, Sea of Galilee',
			creator: 'Ianandwendy.com',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/hope',
		dest: 'src/assets/editorial/topics/hope.jpg',
		md: 'src/content/topics/hope.md',
		kind: 'photograph',
		commons: ['Sunrise Reflections - Lake Louise, Alberta, Canada.jpg'],
		search: 'sunrise lake mountains reflection',
		alt: 'Sunrise on Lake Louise: pink light on snow peaks, the water holding a clear reflection.',
		caption: 'Hope in the Bible is not optimism about the weather. It is waiting for a light you cannot yet walk by — and this is what the waiting is for.',
		credit: {
			title: 'Sunrise at Lake Louise',
			creator: 'Davebloggs007',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/grief',
		dest: 'src/assets/editorial/topics/grief.jpg',
		md: 'src/content/topics/grief.md',
		kind: 'photograph',
		commons: ['Winter in der Rhön.jpg'],
		search: 'winter bare trees snow landscape',
		alt: 'A winter hillside of bare trees and snow, the colour gone out of the ground.',
		caption: 'Grief in Scripture is allowed to look like a season that has stopped producing. The verses do not skip to spring.',
		credit: {
			title: 'Winter in the Rhön',
			creator: 'A.Savin',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/loneliness',
		dest: 'src/assets/editorial/topics/loneliness.jpg',
		md: 'src/content/topics/loneliness.md',
		kind: 'photograph',
		commons: ['Easy Access Path, High Beach, Essex, England 2.jpg'],
		search: 'empty forest path woodland',
		alt: 'A pale path running through a wood, trees on both sides, nobody on the track.',
		caption: 'The lonely psalms are walked, not posed. A path with no one else on it is the honest picture.',
		credit: {
			title: 'Path at High Beach, Essex',
			creator: 'Acabashi',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/love',
		dest: 'src/assets/editorial/topics/love.jpg',
		md: 'src/content/topics/love.md',
		kind: 'art',
		commons: [
			'Henri Horace Roland de la Porte (c.1724-1793) - Still Life with Bread and Wine - YORAG , 764 - York Art Gallery.jpg',
		],
		search: 'still life bread and wine painting',
		alt: 'A still life of bread and wine on a table, painted without a human figure in the frame.',
		caption: 'Biblical love is closer to a shared table than to a feeling. Bread and wine are what the text keeps putting in people’s hands.',
		credit: {
			title: 'Still Life with Bread and Wine',
			creator: 'Henri Horace Roland de la Porte',
			date: '18th century',
			holder: 'York Art Gallery',
		},
	},
	{
		id: 'topics/prayer',
		dest: 'src/assets/editorial/topics/prayer.jpg',
		md: 'src/content/topics/prayer.md',
		kind: 'art',
		commons: [
			'Albrecht Dürer - Praying Hands, 1508 - Google Art Project.jpg',
		],
		search: 'Durer Praying Hands',
		alt: 'Dürer’s study of two praying hands, the sleeves bunched, the fingers pressed together.',
		caption: 'Prayer in the Bible is often this unadorned: hands, and nothing else in the picture to explain them.',
		credit: {
			title: 'Praying Hands',
			creator: 'Albrecht Dürer',
			date: '1508',
			holder: 'Albertina, Vienna',
		},
	},
	{
		id: 'topics/money',
		dest: 'src/assets/editorial/topics/money.jpg',
		md: 'src/content/topics/money.md',
		kind: 'photograph',
		commons: ['Huseifa hoard - Tyrian shekel (1).JPG', 'Tyrian Half-Shekel Heb.JPG'],
		search: 'Tyrian shekel coin',
		alt: 'A silver Tyrian shekel, the kind of coin that circulated in the first-century Levant.',
		caption: 'When the Gospels mention money they mean a real coin, with a weight and a stamp, not an abstraction called “wealth.”',
		credit: {
			title: 'Tyrian shekel from the Huseifa hoard',
			creator: 'Hanay',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/marriage',
		dest: 'src/assets/editorial/topics/marriage.jpg',
		md: 'src/content/topics/marriage.md',
		kind: 'art',
		commons: [
			'Les Noces de Cana - Paolo Veronese - Musée du Louvre Peintures INV 142 ; MR 384.jpg',
		],
		search: 'Veronese Wedding at Cana Louvre',
		alt: 'Veronese’s Wedding at Cana: a crowded feast, musicians, and jars in a vast architectural setting.',
		caption: 'The one wedding Jesus attends in the Gospels is a feast that runs out of wine. Marriage in Scripture is public, costly, and in need of help.',
		credit: {
			title: 'The Wedding at Cana',
			creator: 'Paolo Veronese',
			date: '1563',
			holder: 'Musée du Louvre',
		},
	},
	{
		id: 'topics/family',
		dest: 'src/assets/editorial/topics/family.jpg',
		md: 'src/content/topics/family.md',
		kind: 'art',
		commons: ['Pieter Aertsen Peasants by the Hearth.jpg'],
		search: 'Pieter Aertsen Peasants by the Hearth',
		alt: 'Aertsen’s peasants gathered by a hearth: a household at work and rest in a single room.',
		caption: 'Biblical family is a household, not a portrait studio: people who share a fire, work, and the next meal.',
		credit: {
			title: 'Peasants by the Hearth',
			creator: 'Pieter Aertsen',
			date: 'c. 1556',
			holder: 'Museum Mayer van den Bergh, Antwerp',
		},
	},
	{
		id: 'topics/parenting',
		dest: 'src/assets/editorial/topics/parenting.jpg',
		md: 'src/content/topics/parenting.md',
		kind: 'photograph',
		commons: [
			'Cuneiform tablet with a small second tablet- private letter MET DP-13441-020.jpg',
		],
		search: 'cuneiform tablet letter Metropolitan',
		alt: 'A clay cuneiform letter, the signs pressed into the tablet while it was still soft.',
		caption: 'Deuteronomy tells parents to talk about these words at home and on the road. The oldest way to send a word that far is to press it into something that keeps.',
		credit: {
			title: 'Cuneiform tablet: private letter',
			creator: 'Unknown scribe',
			holder: 'The Metropolitan Museum of Art',
		},
	},
	{
		id: 'topics/faith',
		dest: 'src/assets/editorial/topics/faith.jpg',
		md: 'src/content/topics/faith.md',
		kind: 'photograph',
		commons: ['Sinapis alba subsp. mairei kz03.jpg'],
		search: 'Sinapis alba mustard plant',
		alt: 'A mustard plant in flower, small yellow blooms on a branching green stem.',
		caption: 'Jesus compared faith to a mustard seed because the plant is ordinary and then suddenly not. This is the plant, not a jewel.',
		credit: {
			title: 'White mustard (Sinapis alba)',
			creator: 'Krzysztof Ziarnek',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/forgiveness',
		dest: 'src/assets/editorial/topics/forgiveness.jpg',
		md: 'src/content/topics/forgiveness.md',
		kind: 'art',
		commons: [
			'Rembrandt Harmensz van Rijn - Return of the Prodigal Son - Google Art Project.jpg',
		],
		search: 'Rembrandt Return of the Prodigal Son',
		alt: 'Rembrandt’s Return of the Prodigal Son: the father gathering the kneeling son, the older brother looking on.',
		caption: 'Forgiveness in the Gospels has a body in it. Rembrandt painted the father’s hands, not a slogan.',
		credit: {
			title: 'The Return of the Prodigal Son',
			creator: 'Rembrandt',
			date: 'c. 1668',
			holder: 'The State Hermitage Museum, St Petersburg',
		},
	},
	{
		id: 'topics/friendship',
		dest: 'src/assets/editorial/topics/friendship.jpg',
		md: 'src/content/topics/friendship.md',
		kind: 'art',
		commons: ['Cima da Conegliano - David and Jonathan - WGA04912.jpg'],
		search: 'Cima da Conegliano David and Jonathan',
		alt: 'Cima da Conegliano’s David and Jonathan: two young men in a landscape, one holding Goliath’s head, the covenant between them implied in how they stand.',
		caption: 'The Bible’s strongest picture of friendship is a covenant, not a mood: David and Jonathan bound to each other at a cost.',
		credit: {
			title: 'David and Jonathan',
			creator: 'Cima da Conegliano',
			date: 'c. 1505–1510',
			holder: 'National Gallery, London',
		},
	},
	{
		id: 'topics/gratitude',
		dest: 'src/assets/editorial/topics/gratitude.jpg',
		md: 'src/content/topics/gratitude.md',
		kind: 'art',
		commons: [
			'Pieter Bruegel the Elder - The Harvesters - Google Art Project.jpg',
		],
		search: 'Bruegel The Harvesters',
		alt: 'Bruegel’s Harvesters: a wheat field being cut, some workers eating in the shade, a village beyond.',
		caption: 'Thanksgiving in Scripture is usually for bread that someone had to cut. Bruegel painted the work inside the thanks.',
		credit: {
			title: 'The Harvesters',
			creator: 'Pieter Bruegel the Elder',
			date: '1565',
			holder: 'The Metropolitan Museum of Art',
		},
	},
	{
		id: 'topics/healing',
		dest: 'src/assets/editorial/topics/healing.jpg',
		md: 'src/content/topics/healing.md',
		kind: 'photograph',
		commons: ['Roman medical instruments found in Novae, Bulgaria.jpg'],
		search: 'Roman medical instruments',
		alt: 'A set of Roman bronze medical instruments laid out, probes and blades darkened with age.',
		caption: 'The Gospels’ healings happen in a world that already had doctors and tools. The pages that collect those verses should not pretend otherwise.',
		credit: {
			title: 'Roman medical instruments from Novae',
			creator: 'Vassia Atanassova - Spiritia',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/patience',
		dest: 'src/assets/editorial/topics/patience.jpg',
		md: 'src/content/topics/patience.md',
		kind: 'photograph',
		commons: ['Wooden hourglass 3.jpg'],
		search: 'wooden hourglass sand',
		alt: 'A wooden hourglass standing on a table, sand collected in the lower bulb.',
		caption: 'Patience in the Bible is time you do not control. An hourglass is honest about that in a way a slogan is not.',
		credit: {
			title: 'Wooden hourglass',
			creator: 'User:SJuergen',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/protection',
		dest: 'src/assets/editorial/topics/protection.jpg',
		md: 'src/content/topics/protection.md',
		kind: 'photograph',
		commons: ['Israel-2013-Aerial 21-Masada.jpg'],
		search: 'Masada aerial fortress',
		alt: 'An aerial view of Masada: the plateau fortress, the ramp, and the desert dropping away on every side.',
		caption: '“God is a fortress” is a metaphor borrowed from places like this: high, costly to take, and built because the plain was not safe.',
		credit: {
			title: 'Masada from the air',
			creator: 'Andrew Shiva',
			date: '2013',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/strength',
		dest: 'src/assets/editorial/topics/strength.jpg',
		md: 'src/content/topics/strength.md',
		kind: 'photograph',
		commons: ['Deelerwoud, 09-05-2024 (d.j.b.) 16.jpg'],
		search: 'old oak tree forest',
		alt: 'A large oak in leaf, the trunk thick, the crown filling the frame.',
		caption: 'The Bible’s pictures of strength are living things that have lasted — trees, rocks, a remnant — not a flexed pose.',
		credit: {
			title: 'Oak in Deelerwoud',
			creator: 'Agnes Monkelbaan',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/temptation',
		dest: 'src/assets/editorial/topics/temptation.jpg',
		md: 'src/content/topics/temptation.md',
		kind: 'photograph',
		commons: ['JudeanDesert.jpg'],
		search: 'Judean Desert landscape',
		alt: 'The Judean desert in hard light: pale ground, a few shrubs, hills going back to a dry horizon.',
		caption: 'Jesus’ temptation is set in a wilderness like this, not in a shop. The first tests in the Gospels happen where there is nothing to eat.',
		credit: {
			title: 'The Judean desert',
			creator: 'David Shankbone',
			holder: 'Wikimedia Commons',
		},
	},
	{
		id: 'topics/trust',
		dest: 'src/assets/editorial/topics/trust.jpg',
		md: 'src/content/topics/trust.md',
		kind: 'photograph',
		commons: ['Anchor at Ferguson Marine - geograph.org.uk - 5204496.jpg'],
		search: 'large ship anchor on land',
		alt: 'A heavy ship’s anchor standing on a quay, chain and flukes at rest.',
		caption: 'Hebrews calls hope an anchor. The point of the picture is weight, not decoration: something that holds when the water does not.',
		credit: {
			title: 'Anchor at Ferguson Marine',
			creator: 'Thomas Nugent',
			holder: 'Geograph Britain and Ireland',
		},
	},
	{
		id: 'topics/wisdom',
		dest: 'src/assets/editorial/topics/wisdom.jpg',
		md: 'src/content/topics/wisdom.md',
		kind: 'photograph',
		commons: ['Psalms Scroll.jpg'],
		search: 'Dead Sea Psalms Scroll',
		alt: 'The Psalms Scroll from Qumran, Hebrew columns on darkened parchment.',
		caption: 'Biblical wisdom is a text you copy and return to, not a personality trait. This is what that copying looked like two thousand years ago.',
		credit: {
			title: 'The Psalms Scroll (11Q5)',
			creator: 'Unknown Qumran scribes',
			date: '1st century CE',
			holder: 'Israel Museum, Jerusalem',
		},
	},
	{
		id: 'topics/work',
		dest: 'src/assets/editorial/topics/work.jpg',
		md: 'src/content/topics/work.md',
		kind: 'photograph',
		commons: [
			'Carpenter-tools Beveled-edge-chisel-two-angle-gauges-and-carpenters-pencil-01.jpg',
		],
		search: 'carpenter tools chisel wood',
		alt: 'A carpenter’s chisel, angle gauges, and pencil laid on a wooden bench.',
		caption: 'The Gospels’ word for Joseph is craftsman. Work in Scripture is tools and a trade, not a branding exercise.',
		credit: {
			title: 'Carpenter’s tools',
			creator: 'Anastasia Fedotova',
			holder: 'Wikimedia Commons',
		},
	},

	// Answers
	{
		id: 'answers/what-is-the-unforgivable-sin',
		dest: 'src/assets/editorial/answers/what-is-the-unforgivable-sin.jpg',
		md: 'src/content/answers/what-is-the-unforgivable-sin.md',
		kind: 'photograph',
		commons: [
			'Allentown PA, Muhlenberg College Ms Theol. Pap. 3 (Papyrus 21) recto Matthew 12, 24-26.jpg',
		],
		search: 'Papyrus 21 Matthew 12',
		alt: 'Papyrus 21, a fragment of Matthew 12, the chapter that names blasphemy against the Spirit.',
		caption: 'The unforgivable sin is a sentence in Matthew 12, not a riddle floating free of it. This is an early copy of that page.',
		credit: {
			title: 'Papyrus 21 (Matthew 12:24–26)',
			creator: 'Unknown scribe',
			date: '3rd century',
			holder: 'Muhlenberg College',
		},
	},
	{
		id: 'answers/what-does-the-bible-say-about-tattoos',
		dest: 'src/assets/editorial/answers/what-does-the-bible-say-about-tattoos.jpg',
		md: 'src/content/answers/what-does-the-bible-say-about-tattoos.md',
		kind: 'photograph',
		met: 327434,
		alt: 'A Mesopotamian cylinder seal engraved with a cultic scene, made to roll an image into clay.',
		caption: 'Leviticus 19 is about marks made in a world that already inscribed stone, clay, and skin. The question is which marks, and for whom.',
		credit: {
			title: 'Cylinder seal with cultic scene',
			creator: 'Unknown Mesopotamian seal-cutter',
			holder: 'The Metropolitan Museum of Art',
		},
	},
	{
		id: 'answers/what-does-the-bible-say-about-cremation',
		dest: 'src/assets/editorial/answers/what-does-the-bible-say-about-cremation.jpg',
		md: 'src/content/answers/what-does-the-bible-say-about-cremation.md',
		kind: 'photograph',
		met: 251452,
		alt: 'A Roman glass cinerary urn with its lid, made to hold what fire left of a body.',
		caption: 'Cremation is not a modern invention the Bible never met. Rome put ashes in jars like this while the church was learning how to bury its dead.',
		credit: {
			title: 'Glass cinerary urn with lid',
			creator: 'Unknown Roman glassworker',
			date: '1st–2nd century CE',
			holder: 'The Metropolitan Museum of Art',
		},
	},
	{
		id: 'answers/nephilim-in-the-bible',
		dest: 'src/assets/editorial/answers/nephilim-in-the-bible.jpg',
		md: 'src/content/answers/nephilim-in-the-bible.md',
		kind: 'art',
		commons: [
			'Pieter Bruegel the Elder - The Fall of the Rebel Angels - Google Art Project.jpg',
		],
		search: 'Bruegel Fall of the Rebel Angels',
		alt: 'Bruegel’s Fall of the Rebel Angels: a swarm of hybrid creatures tumbling out of heaven under Michael’s assault.',
		caption: 'Genesis 6’s “sons of God” and the Nephilim have been read as a fall of angels for a very long time. Bruegel painted that reading; the page has to argue with it, not decorate it.',
		credit: {
			title: 'The Fall of the Rebel Angels',
			creator: 'Pieter Bruegel the Elder',
			date: '1562',
			holder: 'Royal Museums of Fine Arts of Belgium',
		},
	},
	{
		id: 'answers/sons-of-god-genesis-6',
		dest: 'src/assets/editorial/answers/sons-of-god-genesis-6.jpg',
		md: 'src/content/answers/sons-of-god-genesis-6.md',
		kind: 'art',
		commons: ['Figures God took Enoch.jpg', 'Paradise Lost 12.jpg'],
		search: 'Enoch taken by God illustration',
		alt: 'A historical illustration of Enoch being taken, a rare picture of the Genesis 5–6 world the “sons of God” debate sits inside.',
		caption: 'The “sons of God” question lives next door to Enoch, who walked with God and was not. The page has to start in that neighbourhood of Genesis, not in a later war in heaven.',
		credit: {
			title: 'God took Enoch',
			creator: 'Unknown illustrator',
			holder: 'Wikimedia Commons',
		},
	},
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

export const hubFigures = {
${objects},
} as const satisfies Record<HubId, EditorialFigure>;
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
	if (hubsReady.length === 5) {
		await writeFile(path.join(ROOT, 'src/lib/images/hubs.ts'), hubTs(hubsReady));
	}

	if (failed) {
		console.error(`\n${failed} of ${CATALOG.length} failed`);
		process.exit(1);
	}
	console.log(`\n${resolved.length} images`);
}

main();

