/**
 * Structural audit of content-ops/questions.
 *
 * Runs on every book, so a typo in chapter 41 of Jeremiah surfaces while that
 * book is still fresh rather than after sixty-five more have been written.
 * Checks what a schema cannot: that a slug is unique across the whole catalog,
 * that a passage actually falls inside the chapter that claims it, and that no
 * question is a chapter-level query wearing a question mark.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'content-ops/questions';

const CHAPTER_COUNTS = {
	GEN: 50, EXO: 40, LEV: 27, NUM: 36, DEU: 34, JOS: 24, JDG: 21, RUT: 4,
	'1SA': 31, '2SA': 24, '1KI': 22, '2KI': 25, '1CH': 29, '2CH': 36,
	EZR: 10, NEH: 13, EST: 10, JOB: 42, PSA: 150, PRO: 31, ECC: 12, SNG: 8,
	ISA: 66, JER: 52, LAM: 5, EZK: 48, DAN: 12, HOS: 14, JOL: 3, AMO: 9,
	OBA: 1, JON: 4, MIC: 7, NAM: 3, HAB: 3, ZEP: 3, HAG: 2, ZEC: 14, MAL: 4,
	MAT: 28, MRK: 16, LUK: 24, JHN: 21, ACT: 28, ROM: 16, '1CO': 16, '2CO': 13,
	GAL: 6, EPH: 6, PHP: 4, COL: 4, '1TH': 5, '2TH': 3, '1TI': 6, '2TI': 4,
	TIT: 3, PHM: 1, HEB: 13, JAS: 5, '1PE': 5, '2PE': 3, '1JN': 5, '2JN': 1,
	'3JN': 1, JUD: 1, REV: 22,
};

const KINDS = new Set([
	'phrase', 'identity', 'doctrine', 'ethics', 'tension',
	'number', 'practice', 'history', 'claim',
]);

/** Chapter-level phrasings the rubric rejects; the chapters collection owns these. */
const TOO_GENERIC = [
	/^what does \w+ \d+ mean\??$/i,
	/^what is (the )?(main )?(theme|message|point) of/i,
	/^what can we learn from \w+ \d+\??$/i,
	/^(a )?summary of/i,
	/^what happens in \w+ \d+\??$/i,
	/^what is \w+ \d+ about\??$/i,
];

const errors = [];
const warnings = [];
const slugs = new Map();
const byBook = new Map();
const byPriority = new Map([[1, 0], [2, 0], [3, 0]]);
let total = 0;

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort();

for (const file of files) {
	const book = file.replace(/\.json$/, '');
	const where = (extra) => `${file}${extra ? ` ${extra}` : ''}`;

	if (!(book in CHAPTER_COUNTS)) {
		errors.push(`${where()}: "${book}" is not a canonical book code`);
		continue;
	}

	let data;
	try {
		data = JSON.parse(await readFile(join(DIR, file), 'utf8'));
	} catch (error) {
		errors.push(`${where()}: invalid JSON — ${error.message}`);
		continue;
	}

	if (data.book !== book) {
		errors.push(`${where()}: "book" is "${data.book}", expected "${book}"`);
	}

	const max = CHAPTER_COUNTS[book];
	let bookTotal = 0;
	const covered = new Set();

	for (const [chapter, questions] of Object.entries(data.chapters ?? {})) {
		const n = Number(chapter);
		if (!Number.isInteger(n) || n < 1 || n > max) {
			errors.push(`${where()}: chapter "${chapter}" is outside 1–${max}`);
			continue;
		}
		if (!Array.isArray(questions) || questions.length === 0) {
			errors.push(`${where(`${chapter}`)}: no questions`);
			continue;
		}
		covered.add(n);

		for (const item of questions) {
			total += 1;
			bookTotal += 1;
			const at = where(`${chapter} "${(item.q ?? '').slice(0, 55)}"`);

			if (!item.q?.endsWith('?')) errors.push(`${at}: q must end in "?"`);
			if ((item.q ?? '').length > 150) errors.push(`${at}: q over 150 chars`);
			if (TOO_GENERIC.some((re) => re.test(item.q ?? ''))) {
				errors.push(`${at}: chapter-level query — the chapters collection owns this`);
			}
			if (!KINDS.has(item.kind)) errors.push(`${at}: unknown kind "${item.kind}"`);
			if (![1, 2, 3].includes(item.priority)) {
				errors.push(`${at}: priority must be 1, 2, or 3`);
			} else {
				byPriority.set(item.priority, byPriority.get(item.priority) + 1);
			}

			if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.slug ?? '')) {
				errors.push(`${at}: slug "${item.slug}" is not kebab-case`);
			} else if (slugs.has(item.slug)) {
				errors.push(`${at}: slug "${item.slug}" already used in ${slugs.get(item.slug)}`);
			} else {
				slugs.set(item.slug, where(String(chapter)));
			}

			// A passage must sit in the chapter that lists it, and name verses.
			const m = /^([A-Z0-9]{3})\.(\d+)\.(\d+)(?:-(\d+))?$/.exec(item.passage ?? '');
			if (!m) {
				errors.push(`${at}: passage "${item.passage}" must be BOOK.chapter.verse[-verse]`);
			} else {
				if (m[1] !== book) errors.push(`${at}: passage book "${m[1]}" != ${book}`);
				if (m[2] !== String(n)) errors.push(`${at}: passage chapter ${m[2]} != ${n}`);
				if (m[4] && Number(m[4]) <= Number(m[3])) {
					errors.push(`${at}: passage range ${m[3]}-${m[4]} does not ascend`);
				}
			}
		}
	}

	byBook.set(book, { total: bookTotal, covered: covered.size, max });
	if (covered.size < max) {
		warnings.push(`${book}: ${covered.size}/${max} chapters covered`);
	}
}

const done = [...byBook.values()].reduce((s, b) => s + b.covered, 0);

console.log(`${files.length}/66 books · ${done}/1189 chapters · ${total} questions`);
for (const [book, b] of byBook) {
	const flag = b.covered < b.max ? ` (${b.covered}/${b.max})` : '';
	console.log(`  ${book.padEnd(4)} ${String(b.total).padStart(4)}${flag}`);
}

const p1 = byPriority.get(1);
if (total > 0) {
	const pct = (n) => Math.round((n / total) * 100);
	console.log(
		`\npriority  1: ${p1} (${pct(p1)}%)  ` +
			`2: ${byPriority.get(2)} (${pct(byPriority.get(2))}%)  ` +
			`3: ${byPriority.get(3)} (${pct(byPriority.get(3))}%)`,
	);
	// A field that is almost all one value cannot order the writing queue.
	// Say so, so nobody sorts by it and believes the result.
	if (pct(p1) > 60) {
		console.log(
			`  NOTE: priority has collapsed toward 1 and cannot be used to rank.\n` +
				`  Run \`npm run questions:export\`, get real volumes, and re-tier.`,
		);
	}
}

if (warnings.length) {
	console.log(`\nIncomplete (${warnings.length}):`);
	for (const w of warnings) console.log(`  ${w}`);
}

if (errors.length) {
	console.error(`\n${errors.length} error${errors.length === 1 ? '' : 's'}:`);
	for (const e of errors.slice(0, 60)) console.error(`  ${e}`);
	if (errors.length > 60) console.error(`  … ${errors.length - 60} more`);
	process.exit(1);
}
console.log('\nNo structural errors.');
