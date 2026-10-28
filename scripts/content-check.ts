import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { getCollection, getEntries, type CollectionReference } from '../src/lib/content';
import { listVerseBriefs } from '../src/lib/verse-briefs';

/** Validate content before a Next.js build and make local figure assets public. */
async function copyEditorialAssets(source: string, destination: string): Promise<number> {
	const entries = await readdir(source, { withFileTypes: true });
	let copied = 0;
	for (const entry of entries) {
		const from = path.join(source, entry.name);
		const to = path.join(destination, entry.name);
		if (entry.isDirectory()) {
			copied += await copyEditorialAssets(from, to);
		} else if (entry.isFile() && /\.(?:avif|gif|jpe?g|png|webp)$/i.test(entry.name)) {
			await mkdir(destination, { recursive: true });
			await copyFile(from, to);
			copied++;
		}
	}
	return copied;
}

async function main() {
	const [topics, answers, chapters, verses] = await Promise.all([
		getCollection('topics'),
		getCollection('answers'),
		getCollection('chapters'),
		listVerseBriefs(),
	]);
	const refs: CollectionReference<'topics'>[] = [
		...topics.flatMap((topic) => topic.data.related),
		...answers.flatMap((answer) => answer.data.relatedTopics),
		...chapters.flatMap((chapter) => chapter.data.relatedTopics),
	];
	const resolved = await getEntries(refs);
	if (resolved.length !== refs.length) {
		const known = new Set(topics.map((topic) => topic.id));
		const missing = [...new Set(refs.filter((ref) => !known.has(ref.id)).map((ref) => ref.id))];
		throw new Error(`Missing related topic entries: ${missing.join(', ')}`);
	}
	const copied = await copyEditorialAssets(
		path.join(process.cwd(), 'src/assets/editorial'),
		path.join(process.cwd(), 'public/editorial'),
	);
	console.log(
		`Validated ${topics.length} topics, ${answers.length} answers, ${chapters.length} chapters, ${verses.length} verse explanations, and ${refs.length} references; copied ${copied} editorial assets.`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
