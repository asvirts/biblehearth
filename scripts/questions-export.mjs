/**
 * Flatten the catalog to CSV for a keyword tool.
 *
 * `priority` in the JSON is a hypothesis about demand. This is how it gets
 * tested: paste the question column into Ahrefs, Semrush, or Keyword Planner,
 * bring the volumes back, and re-sort. Ordered by priority so a truncated
 * paste still covers the questions worth checking first.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'content-ops/questions';
const rows = [];

for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.json'))) {
	const data = JSON.parse(await readFile(join(DIR, file), 'utf8'));
	for (const [chapter, questions] of Object.entries(data.chapters ?? {})) {
		for (const item of questions) {
			rows.push({
				question: item.q,
				book: data.name,
				reference: `${data.name} ${chapter}`,
				passage: item.passage,
				kind: item.kind,
				priority: item.priority,
				url: `/answers/${item.slug}`,
			});
		}
	}
}

rows.sort(
	(a, b) => a.priority - b.priority || a.question.localeCompare(b.question),
);

const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));
const cols = ['question', 'book', 'reference', 'passage', 'kind', 'priority', 'url'];
console.log(cols.join(','));
for (const row of rows) console.log(cols.map((c) => cell(row[c])).join(','));
