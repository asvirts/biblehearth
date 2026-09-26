/**
 * Search demand for the writing backlog, looked up in Ahrefs Keywords Explorer.
 *
 *   npm run keywords -- expand            write the paste batches for today
 *   npm run keywords -- score <dir>       score from the Ahrefs exports in <dir>
 *
 * `expand` turns every unbriefed chapter and every unpublished catalogue question
 * into the forms people actually type, and writes them to
 * content-ops/keywords/<date>/batch-N.txt, at most 10,000 to a file because that
 * is what Keywords Explorer takes in one paste. It also writes keywords.csv,
 * which maps each keyword back to the chapter or question it stands for, and
 * shortened-questions.csv for the hand check the shortening needs before any
 * export is paid for.
 *
 * Paste each batch into Keywords Explorer (Google, United States), export the
 * overview as CSV into the same directory, then run `score`. It writes
 * scores-chapters.csv and scores-questions.csv, highest demand first.
 *
 * The rules are in docs/research/seo/keyword-data-sources.md under "Expansion".
 * The two that shape the numbers:
 *
 * - An item's score is the **max** over its forms, never the sum. Every tool
 *   folds close variants into one figure, so summing counts the same searches
 *   several times.
 * - A question's verse form ("psalm 1:3 meaning") is shared by every question on
 *   that verse. It is left out of the score and kept only as a tiebreak, or one
 *   popular verse would lift every question anchored to it.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

/**
 * Book name and chapter count, by USFM id.
 *
 * Duplicated from src/lib/bible/usfm.ts and src/lib/bible/chapters.ts rather
 * than imported, for the reason given in scripts/chapter-research.mjs: those
 * are TypeScript modules that pull in the YouVersion SDK, and this is a plain
 * node script with no build step.
 */
const BOOKS = {
	GEN: ['Genesis', 50], EXO: ['Exodus', 40], LEV: ['Leviticus', 27],
	NUM: ['Numbers', 36], DEU: ['Deuteronomy', 34], JOS: ['Joshua', 24],
	JDG: ['Judges', 21], RUT: ['Ruth', 4], '1SA': ['1 Samuel', 31],
	'2SA': ['2 Samuel', 24], '1KI': ['1 Kings', 22], '2KI': ['2 Kings', 25],
	'1CH': ['1 Chronicles', 29], '2CH': ['2 Chronicles', 36], EZR: ['Ezra', 10],
	NEH: ['Nehemiah', 13], EST: ['Esther', 10], JOB: ['Job', 42],
	PSA: ['Psalms', 150], PRO: ['Proverbs', 31], ECC: ['Ecclesiastes', 12],
	SNG: ['Song of Songs', 8], ISA: ['Isaiah', 66], JER: ['Jeremiah', 52],
	LAM: ['Lamentations', 5], EZK: ['Ezekiel', 48], DAN: ['Daniel', 12],
	HOS: ['Hosea', 14], JOL: ['Joel', 3], AMO: ['Amos', 9], OBA: ['Obadiah', 1],
	JON: ['Jonah', 4], MIC: ['Micah', 7], NAM: ['Nahum', 3], HAB: ['Habakkuk', 3],
	ZEP: ['Zephaniah', 3], HAG: ['Haggai', 2], ZEC: ['Zechariah', 14],
	MAL: ['Malachi', 4], MAT: ['Matthew', 28], MRK: ['Mark', 16], LUK: ['Luke', 24],
	JHN: ['John', 21], ACT: ['Acts', 28], ROM: ['Romans', 16],
	'1CO': ['1 Corinthians', 16], '2CO': ['2 Corinthians', 13], GAL: ['Galatians', 6],
	EPH: ['Ephesians', 6], PHP: ['Philippians', 4], COL: ['Colossians', 4],
	'1TH': ['1 Thessalonians', 5], '2TH': ['2 Thessalonians', 3],
	'1TI': ['1 Timothy', 6], '2TI': ['2 Timothy', 4], TIT: ['Titus', 3],
	PHM: ['Philemon', 1], HEB: ['Hebrews', 13], JAS: ['James', 5],
	'1PE': ['1 Peter', 5], '2PE': ['2 Peter', 3], '1JN': ['1 John', 5],
	'2JN': ['2 John', 1], '3JN': ['3 John', 1], JUD: ['Jude', 1],
	REV: ['Revelation', 22],
};

/** The name in front of a chapter number: "Psalm 23", never "Psalms 23". */
const chapterName = (usfm) => (usfm === 'PSA' ? 'Psalm' : BOOKS[usfm][0]);

/**
 * Other spellings of a book that people search with. Each becomes extra forms of
 * the same chapter, folded into its max rather than scored on its own.
 */
function nameVariants(usfm) {
	const name = chapterName(usfm);
	const out = [];
	if (usfm === 'PSA') out.push('Psalms');
	if (usfm === 'SNG') out.push('Song of Solomon');
	if (usfm === 'REV') out.push('Revelations');
	const numbered = /^([123]) (.+)$/.exec(name);
	if (numbered) out.push(`${['first', 'second', 'third'][numbered[1] - 1]} ${numbered[2]}`);
	return out;
}

/** The forms a chapter is scored on, and the bare reference kept for context. */
const STUDY_FORMS = [
	(c) => `${c} meaning`,
	(c) => `${c} explained`,
	(c) => `${c} summary`,
	(c) => `${c} commentary`,
	(c) => `what is ${c} about`,
];

/** Keyword Planner's limit, which the other tools' long-tail data tracks. */
const MAX_WORDS = 10;
const MAX_CHARS = 80;

const words = (s) => s.trim().split(/\s+/).filter(Boolean);
const fits = (s) => words(s).length <= MAX_WORDS && s.length <= MAX_CHARS;

/** Lower-cased, with punctuation gone except the colon in a verse reference. */
function normalise(s) {
	return s
		.toLowerCase()
		.replace(/[‘’]/g, "'")
		.replace(/(\d),(\d)/g, '$1$2')
		.replace(/[“”"?!.,;()—–]/g, ' ')
		.replace(/(?<!\d):|:(?!\d)/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Words a cut should never end on. */
const DANGLING = new Set([
	'to', 'your', 'in', 'of', 'the', 'a', 'an', 'from', 'by', 'for', 'on', 'with',
	'that', 'will', 'and', 'or', 'is', 'are', 'can', 'could', 'would', 'should',
	'into', 'at', 'his', 'her', 'their', 'my', 'our', 'its', 'as', 'but', 'so',
	'he', 'she', 'they', 'it', 'we',
]);

/** Where a trailing clause starts: a comma, or a word that opens one. */
const CLAUSE_BREAK =
	/,\s|\s(?:so|if|and|or|but|because|versus|when|while|who|that|about|since|even though|rather than|instead of)\s/g;

/**
 * A question too long to look up, cut to a form someone would type.
 *
 * Keyword tools match the exact string, so a sentence with words picked out of
 * it returns nothing. This keeps the question's own wording and cuts only whole
 * pieces off the end:
 *
 * - "What does <phrase> mean …?" becomes "<phrase> meaning", which is how
 *   people search for a line of Scripture.
 * - Anything else loses trailing clauses ("…, and how is it different from a
 *   prophet") until it fits, and is cut at ten words if it still does not.
 *
 * Still mechanical, which is what the hand check on shortened-questions.csv is
 * for.
 */
export function shorten(question) {
	const text = question
		.toLowerCase()
		.replace(/[‘’]/g, "'")
		.replace(/(\d),(\d)/g, '$1$2')
		.replace(/[?!.]+$/, '')
		.trim();

	// "What does Jesus mean by <phrase>?" is a question about the phrase.
	// "What does it mean to be sealed …?" is a question about being sealed.
	const speaker =
		/^what (?:does|did) \S+ mean (?:by|that|when) (.+)$/.exec(text) ??
		/^what (?:does|did) it mean to (?:be )?(.+)$/.exec(text);
	// "Does <phrase> mean …?" only when the phrase is a quotation. "Does Acts
	// 2:38 mean …" is asking about a reference, which the verse form covers.
	const meaning =
		speaker ??
		/^what (?:does|do|did) (?!it mean)((?:\S+\s)+?\S+) mean\b/.exec(text) ??
		/^(?:does|do) ((?:\S+\s){2,}?\S+) mean\b/.exec(text)?.filter((m, i) => i === 0 || !/\d/.test(m));
	if (meaning?.[1]) {
		// A quoted line with a comma in it is two clauses; the first is the one
		// people search for.
		let quoted = meaning[1];
		const comma = quoted.indexOf(',');
		if (!fits(`${normalise(quoted)} meaning`) && comma > 0 && words(quoted.slice(0, comma)).length >= 3) {
			quoted = quoted.slice(0, comma);
		}
		const phrase = words(normalise(quoted));
		while ((!fits([...phrase, 'meaning'].join(' ')) || DANGLING.has(phrase.at(-1))) && phrase.length > 1) phrase.pop();
		return [...phrase, 'meaning'].join(' ');
	}

	let cut = text;
	while (!fits(normalise(cut))) {
		// A comma is a real clause boundary; a word like "and" often is not
		// ("Judah and Tamar"), so it has to leave more of the question behind.
		const breaks = [...cut.matchAll(CLAUSE_BREAK)]
			.filter((m) => words(cut.slice(0, m.index)).length >= (m[0].startsWith(',') ? 3 : 7))
			.map((m) => m.index);
		if (!breaks.length) break;
		cut = cut.slice(0, breaks.at(-1));
	}
	const all = words(normalise(cut));
	const out = all.slice(0, MAX_WORDS);
	while (out.join(' ').length > MAX_CHARS) out.pop();
	// A cut that lands inside "in 2 Kings 20" drops the whole reference.
	if (out.length < all.length && /^\d/.test(all[out.length])) {
		const at = out.findLastIndex((w) => w === 'in' || w === 'from');
		if (at > 3) out.length = at;
	}
	while (out.length > 4 && DANGLING.has(out.at(-1))) out.pop();
	return out.join(' ');
}

/** "EZR.1.1-4" → "ezra 1:1"; "PSA.23" → "psalm 23". */
function verseReference(passage) {
	const [book, chapter, verse] = passage.split('.');
	if (!BOOKS[book]) return null;
	const first = verse?.split('-')[0];
	return `${chapterName(book)} ${chapter}${first ? `:${first}` : ''}`.toLowerCase();
}

const csvCell = (v) => {
	const s = v == null ? '' : String(v);
	return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const toCsv = (cols, rows) =>
	[cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';

async function briefedChapters() {
	// English briefs only: the localized ones sit in es/, pt/ and are looked up,
	// if ever, in their own language.
	const dir = 'src/content/chapters';
	const out = new Set();
	for (const file of (await readdir(dir)).filter((f) => /\.mdx?$/.test(f))) {
		const usfm = /^usfm:\s*(\S+)/m.exec(await readFile(join(dir, file), 'utf8'))?.[1];
		if (usfm) out.add(usfm.toUpperCase());
	}
	return out;
}

async function publishedAnswers() {
	return new Set(
		(await readdir('src/content/answers')).map((f) => basename(f).replace(/\.mdx?$/, '')),
	);
}

async function catalogue() {
	const dir = 'content-ops/questions';
	const out = [];
	for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()) {
		const data = JSON.parse(await readFile(join(dir, file), 'utf8'));
		for (const [chapter, items] of Object.entries(data.chapters ?? {})) {
			for (const item of items) out.push({ ...item, book: data.book, chapter });
		}
	}
	return out;
}

async function expand() {
	const date = new Date().toISOString().slice(0, 10);
	const dir = join('content-ops/keywords', date);
	await mkdir(dir, { recursive: true });

	/** keyword → the rows that stand behind it */
	const rows = [];
	const add = (keyword, item, form) => rows.push({ keyword: keyword.toLowerCase(), item, form });

	const briefed = await briefedChapters();
	let chapters = 0;
	for (const [usfm, [, count]] of Object.entries(BOOKS)) {
		for (let n = 1; n <= count; n++) {
			if (briefed.has(`${usfm}.${n}`)) continue;
			chapters++;
			const item = `chapter:${usfm}.${n}`;
			const names = [chapterName(usfm), ...nameVariants(usfm)];
			names.forEach((name, i) => {
				const c = `${name} ${n}`;
				for (const form of STUDY_FORMS) add(form(c), item, i === 0 ? 'study' : 'study-variant');
			});
			add(`${chapterName(usfm)} ${n}`, item, 'bare');
		}
	}

	const published = await publishedAnswers();
	const shortened = [];
	let questions = 0;
	for (const q of await catalogue()) {
		if (published.has(q.slug)) continue;
		questions++;
		const item = `question:${q.slug}`;
		const raw = normalise(q.q);
		if (fits(raw)) add(raw, item, 'raw');
		else {
			const short = shorten(q.q);
			add(short, item, 'shortened');
			shortened.push({ slug: q.slug, question: q.q, shortened: short });
		}
		add(`${q.slug.replaceAll('-', ' ')} meaning`, item, 'phrase');
		const ref = verseReference(q.passage);
		if (ref) add(`${ref} meaning`, item, 'verse');
	}

	const unique = [...new Set(rows.map((r) => r.keyword))];
	const BATCH = 10_000;
	for (let i = 0; i * BATCH < unique.length; i++) {
		await writeFile(join(dir, `batch-${i + 1}.txt`), unique.slice(i * BATCH, (i + 1) * BATCH).join('\n') + '\n');
	}
	await writeFile(join(dir, 'keywords.csv'), toCsv(['keyword', 'item', 'form'], rows));
	await writeFile(join(dir, 'shortened-questions.csv'), toCsv(['slug', 'question', 'shortened'], shortened));

	console.log(`${chapters} chapters and ${questions} questions → ${unique.length} unique keywords`);
	console.log(`${Math.ceil(unique.length / BATCH)} batches, ${shortened.length} shortened questions to spot-check`);
	console.log(`written to ${dir}`);
}

/**
 * An Ahrefs export: UTF-16 with tabs, or UTF-8 with commas, depending on which
 * export option was picked. Both are read; the header names are matched loosely.
 */
function parseExport(buffer) {
	const text =
		buffer[0] === 0xff && buffer[1] === 0xfe
			? buffer.subarray(2).toString('utf16le')
			: buffer.toString('utf8').replace(/^﻿/, '');
	const lines = text.split(/\r?\n/).filter((l) => l.trim());
	const delimiter = lines[0].includes('\t') ? '\t' : ',';
	const split = (line) => {
		const cells = [];
		let cell = '';
		let quoted = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (quoted) {
				if (ch === '"' && line[i + 1] === '"') (cell += '"'), i++;
				else if (ch === '"') quoted = false;
				else cell += ch;
			} else if (ch === '"') quoted = true;
			else if (ch === delimiter) cells.push(cell), (cell = '');
			else cell += ch;
		}
		cells.push(cell);
		return cells;
	};
	const header = split(lines[0]).map((h) => h.trim().toLowerCase());
	const col = (re) => header.findIndex((h) => re.test(h));
	const at = { keyword: col(/^keyword$/), volume: col(/^volume$/), kd: col(/^(difficulty|kd)$/) };
	if (at.keyword < 0 || at.volume < 0) {
		throw new Error(`no Keyword/Volume columns in export (header: ${header.join(' | ')})`);
	}
	const out = new Map();
	for (const line of lines.slice(1)) {
		const cells = split(line);
		const number = (i) => (i < 0 || cells[i] === '' ? null : Number(cells[i].replace(/,/g, '')));
		out.set(cells[at.keyword].trim().toLowerCase(), { volume: number(at.volume), kd: number(at.kd) });
	}
	return out;
}

async function score(dir) {
	if (!dir) throw new Error('usage: npm run keywords -- score <dir>');
	const metrics = new Map();
	const exports = (await readdir(dir)).filter((f) => /\.(csv|tsv)$/i.test(f) && !/^(keywords|shortened-questions|scores-)/.test(f));
	if (!exports.length) throw new Error(`no Ahrefs exports in ${dir}`);
	for (const file of exports) {
		for (const [k, v] of parseExport(await readFile(join(dir, file)))) metrics.set(k, v);
	}

	// Written by `expand` from normalised text, so it never holds a comma or a quote.
	const mapping = (await readFile(join(dir, 'keywords.csv'), 'utf8')).trim().split('\n').slice(1).map((line) => {
		const [keyword, item, form] = line.split(',');
		return { keyword, item, form };
	});

	const items = new Map();
	for (const { keyword, item, form } of mapping) {
		if (!items.has(item)) items.set(item, []);
		items.get(item).push({ keyword, form, ...(metrics.get(keyword) ?? { volume: null, kd: null }) });
	}

	const best = (forms) =>
		forms.filter((f) => f.volume != null).sort((a, b) => b.volume - a.volume)[0] ?? null;
	const chapters = [];
	const questions = [];
	let missing = 0;
	for (const [item, forms] of items) {
		const [type, id] = item.split(/:(.+)/);
		if (forms.every((f) => f.volume == null)) missing++;
		if (type === 'chapter') {
			const top = best(forms.filter((f) => f.form.startsWith('study')));
			const meaning = forms.find((f) => f.form === 'study' && f.keyword.endsWith(' meaning'));
			const [usfm, n] = id.split('.');
			chapters.push({
				usfm: id,
				chapter: `${chapterName(usfm)} ${n}`,
				score: top?.volume ?? null,
				best_keyword: top?.keyword ?? '',
				kd: meaning?.kd ?? '',
				bare_volume: forms.find((f) => f.form === 'bare')?.volume ?? '',
			});
		} else {
			const top = best(forms.filter((f) => f.form !== 'verse'));
			const verse = forms.find((f) => f.form === 'verse');
			questions.push({
				slug: id,
				score: top?.volume ?? null,
				best_keyword: top?.keyword ?? '',
				kd: top?.kd ?? '',
				verse_volume: verse?.volume ?? null,
				verse_keyword: verse?.keyword ?? '',
			});
		}
	}
	// No data sorts below a looked-up zero, and prints as a blank rather than 0.
	const n = (v) => v ?? -1;
	chapters.sort((a, b) => n(b.score) - n(a.score) || a.usfm.localeCompare(b.usfm));
	questions.sort(
		(a, b) => n(b.score) - n(a.score) || n(b.verse_volume) - n(a.verse_volume) || a.slug.localeCompare(b.slug),
	);

	await writeFile(join(dir, 'scores-chapters.csv'), toCsv(['usfm', 'chapter', 'score', 'best_keyword', 'kd', 'bare_volume'], chapters));
	await writeFile(join(dir, 'scores-questions.csv'), toCsv(['slug', 'score', 'best_keyword', 'kd', 'verse_volume', 'verse_keyword'], questions));
	const looked = new Set(mapping.map((m) => m.keyword));
	const found = [...looked].filter((k) => metrics.has(k)).length;
	console.log(`${found} of ${looked.size} keywords found in ${exports.length} export(s)`);
	console.log(`${chapters.length} chapters and ${questions.length} questions scored; ${missing} with no data on any form`);
}

const [command, arg] = process.argv.slice(2);
if (command === 'expand') await expand();
else if (command === 'score') await score(arg);
else {
	console.error('usage: npm run keywords -- expand | score <dir>');
	process.exit(1);
}
