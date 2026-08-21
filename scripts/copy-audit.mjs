#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const CONTENT_ROOT = path.resolve('src/content');

const PATTERNS = {
	en: [
		['rather than', /\brather than\b/giu],
		['does not', /\bdoes not\b/giu],
		['not … but', /\bnot\b[^.!?\n]{0,100}\bbut\b/giu],
		['actually', /\bactually\b/giu],
		['genuinely', /\bgenuinely\b/giu],
		['the point', /\bthe point\b/giu],
		['refuse variants', /\brefus(?:e|es|ed|ing)\b/giu],
		['em dash', /—/gu],
	],
	es: [
		['en lugar de', /\ben lugar de\b/giu],
		['no … sino/pero', /\bno\b[^.!?\n]{0,100}\b(?:sino|pero)\b/giu],
		['realmente', /\brealmente\b/giu],
		['en realidad', /\ben realidad\b/giu],
		['el punto', /\bel punto\b/giu],
		['em dash', /—/gu],
	],
	pt: [
		['em vez de', /\bem vez de\b/giu],
		['ao invés de', /\bao invés de\b/giu],
		['não … mas', /\bnão\b[^.!?\n]{0,100}\bmas\b/giu],
		['realmente', /\brealmente\b/giu],
		['na verdade', /\bna verdade\b/giu],
		['o ponto', /\bo ponto\b/giu],
		['em dash', /—/gu],
	],
};

function localeFor(file) {
	const relative = path.relative(CONTENT_ROOT, file).split(path.sep);
	return relative.length > 2 && ['es', 'pt'].includes(relative[1])
		? relative[1]
		: 'en';
}

async function markdownFiles(directory) {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const candidate = path.join(directory, entry.name);
			if (entry.isDirectory()) return markdownFiles(candidate);
			return entry.isFile() && entry.name.endsWith('.md') ? [candidate] : [];
		}),
	);
	return nested.flat();
}

function countWords(text) {
	return text.match(/\b[\p{L}\p{N}]+\b/gu)?.length ?? 0;
}

function repeatedOpenings(text) {
	const prose = text
		.replace(/^---[\s\S]*?^---$/mu, '')
		.replace(/^\s*(?:[-*]|\d+\.)\s+/gmu, '')
		.replace(/^#{1,6}\s+/gmu, '');
	const sentences = prose
		.split(/(?<=[.!?])\s+|\n{2,}/u)
		.map((sentence) =>
			sentence
				.toLocaleLowerCase()
				.replace(/^[^\p{L}\p{N}]+/u, '')
				.match(/^[\p{L}\p{N}'’]+(?:\s+[\p{L}\p{N}'’]+){0,2}/u)?.[0],
		)
		.filter((opening) => opening && opening.split(/\s+/u).length >= 2);
	const counts = new Map();
	for (const opening of sentences) {
		counts.set(opening, (counts.get(opening) ?? 0) + 1);
	}
	return [...counts.entries()]
		.filter(([, count]) => count >= 3)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([opening, count]) => ({ opening, count }));
}

function inspect(file, text) {
	const locale = localeFor(file);
	const markers = Object.fromEntries(
		PATTERNS[locale].map(([name, expression]) => [
			name,
			text.match(expression)?.length ?? 0,
		]),
	);
	const words = countWords(text);
	const markerCount = Object.values(markers).reduce((sum, value) => sum + value, 0);
	return {
		file: path.relative(process.cwd(), file),
		locale,
		words,
		markerCount,
		markersPerThousand: words
			? Number(((markerCount * 1000) / words).toFixed(1))
			: 0,
		markers,
		repeatedOpenings: repeatedOpenings(text),
	};
}

function summarize(files) {
	const byLocale = {};
	for (const file of files) {
		const current = byLocale[file.locale] ?? {
			files: 0,
			words: 0,
			markerCount: 0,
		};
		current.files += 1;
		current.words += file.words;
		current.markerCount += file.markerCount;
		byLocale[file.locale] = current;
	}
	for (const value of Object.values(byLocale)) {
		value.markersPerThousand = value.words
			? Number(((value.markerCount * 1000) / value.words).toFixed(1))
			: 0;
	}
	return byLocale;
}

function renderHuman(result) {
	console.log('BibleHearth copy audit (diagnostic only)\n');
	for (const [locale, summary] of Object.entries(result.summary)) {
		console.log(
			`${locale}: ${summary.files} files, ${summary.words.toLocaleString()} words, ` +
				`${summary.markerCount} markers (${summary.markersPerThousand}/1,000 words)`,
		);
	}
	console.log('\nHighest marker density:');
	for (const file of result.files.slice(0, 20)) {
		const details = Object.entries(file.markers)
			.filter(([, count]) => count > 0)
			.map(([name, count]) => `${name} ${count}`)
			.join(', ');
		console.log(
			`${file.markersPerThousand.toFixed(1).padStart(5)}  ${file.file}` +
				(details ? `  (${details})` : ''),
		);
		for (const repeat of file.repeatedOpenings) {
			console.log(`       repeated opening ${repeat.count}×: “${repeat.opening}”`);
		}
	}
	console.log(
		'\nFindings never fail the build. Read the flagged passages and keep any wording that is still the clearest choice.',
	);
}

async function main() {
	const json = process.argv.slice(2).includes('--json');
	const files = await markdownFiles(CONTENT_ROOT);
	const inspected = await Promise.all(
		files.map(async (file) => inspect(file, await fs.readFile(file, 'utf8'))),
	);
	inspected.sort(
		(a, b) =>
			b.markersPerThousand - a.markersPerThousand ||
			a.file.localeCompare(b.file),
	);
	const result = { summary: summarize(inspected), files: inspected };
	if (json) console.log(JSON.stringify(result, null, 2));
	else renderHuman(result);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
