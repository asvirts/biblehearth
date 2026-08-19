/**
 * Everything needed to write one chapter brief, gathered in one place.
 *
 * Authoring a brief means holding four things at once: the chapter itself, what
 * three commentaries said about it, which questions people actually type about
 * it, and which topic pages exist to link to. Collecting those by hand is the
 * slow half of the job and the half most likely to be skipped — and a brief
 * written without the commentaries in front of you is a brief that repeats what
 * everyone else already published.
 *
 * Two deliberate choices about where the text comes from:
 *
 *  - The chapter is fetched in the Berean Standard Bible from the same open API
 *    as the commentaries, not from YouVersion. Authoring must not spend quota on
 *    a rate-limited app key (see src/lib/cache/limiter.ts for what happens when
 *    it does), and for working out what a chapter *says* a public-domain
 *    translation is exactly as good.
 *  - Commentary is printed in full rather than summarised. The summarising is
 *    the writer's job, and a digest of a digest is how a brief ends up saying
 *    nothing that could be disagreed with.
 *
 *   node scripts/chapter-research.mjs PSA.28
 *   node scripts/chapter-research.mjs "psalm 28"
 *   node scripts/chapter-research.mjs psalms/28
 */
import { readdir, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const API = 'https://bible.helloao.org';
const SOURCES = [
	['tyndale', 'Tyndale Open Study Notes (2023, CC BY-SA 4.0) — plainest, read first'],
	['matthew-henry', "Matthew Henry's Commentary (1706–1714, public domain)"],
	['jamieson-fausset-brown', 'Jamieson-Fausset-Brown (1871, public domain)'],
];

/**
 * Book slug, name and chapter count.
 *
 * Duplicated from src/lib/bible/usfm.ts and src/lib/bible/chapters.ts rather
 * than imported, because those are TypeScript modules that pull in the
 * YouVersion SDK and this is a plain node script with no build step — the same
 * trade already made in scripts/questions-audit.mjs.
 */
const BOOKS = {
	GEN: ['genesis', 'Genesis', 50], EXO: ['exodus', 'Exodus', 40],
	LEV: ['leviticus', 'Leviticus', 27], NUM: ['numbers', 'Numbers', 36],
	DEU: ['deuteronomy', 'Deuteronomy', 34], JOS: ['joshua', 'Joshua', 24],
	JDG: ['judges', 'Judges', 21], RUT: ['ruth', 'Ruth', 4],
	'1SA': ['1-samuel', '1 Samuel', 31], '2SA': ['2-samuel', '2 Samuel', 24],
	'1KI': ['1-kings', '1 Kings', 22], '2KI': ['2-kings', '2 Kings', 25],
	'1CH': ['1-chronicles', '1 Chronicles', 29], '2CH': ['2-chronicles', '2 Chronicles', 36],
	EZR: ['ezra', 'Ezra', 10], NEH: ['nehemiah', 'Nehemiah', 13],
	EST: ['esther', 'Esther', 10], JOB: ['job', 'Job', 42],
	PSA: ['psalms', 'Psalms', 150], PRO: ['proverbs', 'Proverbs', 31],
	ECC: ['ecclesiastes', 'Ecclesiastes', 12], SNG: ['song-of-songs', 'Song of Songs', 8],
	ISA: ['isaiah', 'Isaiah', 66], JER: ['jeremiah', 'Jeremiah', 52],
	LAM: ['lamentations', 'Lamentations', 5], EZK: ['ezekiel', 'Ezekiel', 48],
	DAN: ['daniel', 'Daniel', 12], HOS: ['hosea', 'Hosea', 14],
	JOL: ['joel', 'Joel', 3], AMO: ['amos', 'Amos', 9],
	OBA: ['obadiah', 'Obadiah', 1], JON: ['jonah', 'Jonah', 4],
	MIC: ['micah', 'Micah', 7], NAM: ['nahum', 'Nahum', 3],
	HAB: ['habakkuk', 'Habakkuk', 3], ZEP: ['zephaniah', 'Zephaniah', 3],
	HAG: ['haggai', 'Haggai', 2], ZEC: ['zechariah', 'Zechariah', 14],
	MAL: ['malachi', 'Malachi', 4], MAT: ['matthew', 'Matthew', 28],
	MRK: ['mark', 'Mark', 16], LUK: ['luke', 'Luke', 24],
	JHN: ['john', 'John', 21], ACT: ['acts', 'Acts', 28],
	ROM: ['romans', 'Romans', 16], '1CO': ['1-corinthians', '1 Corinthians', 16],
	'2CO': ['2-corinthians', '2 Corinthians', 13], GAL: ['galatians', 'Galatians', 6],
	EPH: ['ephesians', 'Ephesians', 6], PHP: ['philippians', 'Philippians', 4],
	COL: ['colossians', 'Colossians', 4], '1TH': ['1-thessalonians', '1 Thessalonians', 5],
	'2TH': ['2-thessalonians', '2 Thessalonians', 3], '1TI': ['1-timothy', '1 Timothy', 6],
	'2TI': ['2-timothy', '2 Timothy', 4], TIT: ['titus', 'Titus', 3],
	PHM: ['philemon', 'Philemon', 1], HEB: ['hebrews', 'Hebrews', 13],
	JAS: ['james', 'James', 5], '1PE': ['1-peter', '1 Peter', 5],
	'2PE': ['2-peter', '2 Peter', 3], '1JN': ['1-john', '1 John', 5],
	'2JN': ['2-john', '2 John', 1], '3JN': ['3-john', '3 John', 1],
	JUD: ['jude', 'Jude', 1], REV: ['revelation', 'Revelation', 22],
};

/** Query spellings people type, mapped to the USFM id. */
const ALIASES = new Map();
for (const [usfm, [slug, name]] of Object.entries(BOOKS)) {
	ALIASES.set(usfm.toLowerCase(), usfm);
	ALIASES.set(slug, usfm);
	ALIASES.set(name.toLowerCase(), usfm);
	// "Psalm 28", "Proverb 3" — the singular is what a reader writes.
	if (name.endsWith('s')) ALIASES.set(name.toLowerCase().slice(0, -1), usfm);
}

function parseRef(input) {
	const cleaned = input.trim().toLowerCase().replace(/[./]+/g, ' ').replace(/\s+/g, ' ');
	const match = cleaned.match(/^(.+?)\s+(\d+)$/);
	if (!match) return null;
	const usfm = ALIASES.get(match[1]);
	if (!usfm) return null;
	const chapter = Number(match[2]);
	if (!Number.isInteger(chapter) || chapter < 1 || chapter > BOOKS[usfm][2]) {
		return null;
	}
	return { usfm, chapter, slug: BOOKS[usfm][0], name: BOOKS[usfm][1] };
}

async function getJson(path) {
	const response = await fetch(`${API}${path}`, {
		headers: { Accept: 'application/json' },
		signal: AbortSignal.timeout(15_000),
	});
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
	return response.json();
}

/** Commentary payloads are HTML fragments; a dossier wants readable prose. */
function plain(value) {
	return String(value)
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/[ \t]+/g, ' ')
		.trim();
}

function verses(payload) {
	return (payload?.chapter?.content ?? []).filter((item) => item.type === 'verse');
}

function textOf(item) {
	return plain(
		(item.content ?? [])
			.map((part) => (typeof part === 'string' ? part : (part?.text ?? '')))
			.join(' '),
	);
}

const input = process.argv.slice(2).join(' ');
if (!input) {
	console.error('usage: node scripts/chapter-research.mjs <reference>   e.g. PSA.28 | "psalm 28" | psalms/28');
	process.exit(2);
}

const ref = parseRef(input);
if (!ref) {
	console.error(`Could not read "${input}" as a chapter of the 66-book canon.`);
	process.exit(2);
}

const { usfm, chapter, slug, name } = ref;
// "Psalm 28", not "Psalms 28" — see bookNameForChapter in src/lib/bible/usfm.ts.
const reference = `${name.endsWith('s') && usfm === 'PSA' ? 'Psalm' : name} ${chapter}`;
const target = `src/content/chapters/${slug}-${chapter}.md`;

const [scripture, ...commentaries] = await Promise.all([
	getJson(`/api/BSB/${usfm}/${chapter}.json`).catch(() => null),
	...SOURCES.map(([id]) => getJson(`/api/c/${id}/${usfm}/${chapter}.json`).catch(() => null)),
]);

const existing = await access(target).then(() => true, () => false);
const briefs = (await readdir('src/content/chapters')).filter((f) => f.endsWith('.md')).sort();
const topics = (await readdir('src/content/topics'))
	.filter((f) => f.endsWith('.md'))
	.map((f) => f.replace(/\.md$/, ''))
	.sort();

let questions = [];
try {
	const catalog = JSON.parse(await readFile(join('content-ops/questions', `${usfm}.json`), 'utf8'));
	questions = catalog.chapters?.[String(chapter)] ?? [];
} catch {
	// A book with no catalogued questions is a gap in the catalog, not an error.
}

const out = [];
out.push(`# Research dossier — ${reference} (${usfm}.${chapter})`);
out.push('');
out.push(`- Write to: \`${target}\`${existing ? '  **← already exists; you are revising, not creating**' : ''}`);
out.push(`- Publishes at: https://biblehearth.online/${slug}/${chapter}`);
out.push(`- Frontmatter \`usfm:\` value: \`${usfm}.${chapter}\``);
out.push(`- Book has ${BOOKS[usfm][2]} chapters; ${briefs.length} brief(s) exist site-wide.`);
out.push('');

out.push(`## ${reference}, in full (Berean Standard Bible)`);
out.push('');
out.push('_Public-domain text, used here only so authoring costs no YouVersion quota. The');
out.push('published page renders the licensed default version instead._');
out.push('');
if (scripture) {
	for (const item of scripture.chapter?.content ?? []) {
		if (item.type === 'heading') out.push(`### ${plain((item.content ?? []).join(' '))}`);
		else if (item.type === 'verse') out.push(`**${item.number}** ${textOf(item)}`);
	}
} else {
	out.push('_Unavailable — the open Bible API did not answer. Read the chapter before writing._');
}
out.push('');

for (const [index, [id, about]] of SOURCES.entries()) {
	const payload = commentaries[index];
	out.push(`## ${about}`);
	out.push('');
	if (!payload) {
		out.push(`_No notes on ${reference}. Normal — Henry skipped Song of Songs, Tyndale skipped Judges._`);
		out.push('');
		continue;
	}
	const intro = payload.chapter?.introduction;
	if (intro) {
		out.push(`**Chapter introduction.** ${plain(intro)}`);
		out.push('');
	}
	for (const item of verses(payload)) {
		const body = textOf(item);
		if (body) {
			out.push(`**v${item.number}.** ${body}`);
			out.push('');
		}
	}
	out.push(`_Source id: \`${id}\`. Do not paste this text into the brief — the page already renders it in full below your writing. Your job is to say what it means in your own words._`);
	out.push('');
}

out.push(`## Catalogued questions for ${reference}`);
out.push('');
if (questions.length) {
	out.push('From `content-ops/questions/` — the phrase-level queries already researched for');
	out.push('this chapter. Each one belongs in `faqs` or in `glossary`, phrased as asked.');
	out.push('');
	for (const q of questions) {
		out.push(`- **${q.q}** — \`${q.passage}\`, ${q.kind}, priority ${q.priority}`);
	}
} else {
	out.push(`_None catalogued for ${reference}. Write the FAQs from the chapter itself, and consider adding entries to \`content-ops/questions/${usfm}.json\`._`);
}
out.push('');

out.push('## Valid `relatedTopics` values');
out.push('');
out.push('Only these exist. A slug not on this list fails the content build.');
out.push('');
out.push(topics.join(' · '));
out.push('');

out.push('## Briefs already published');
out.push('');
out.push(briefs.length ? briefs.map((f) => `- ${f.replace(/\.md$/, '')}`).join('\n') : '_None._');
out.push('');

console.log(out.join('\n'));
