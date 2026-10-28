import { marked } from 'marked';
import { getCollection } from './content';
import { verseHubPath } from './bible/urls';
import { chapterInRange } from './bible/chapters';

/** Authored commentary only; this module never fetches licensed Scripture. */
export async function listVerseBriefs() {
	const briefs = await getCollection('verses', ({ data }) => !data.draft);
	const seen = new Set<string>();
	for (const { id, data } of briefs) {
		const [book = '', chapter = ''] = data.usfm.split('.');
		const path = verseHubPath(data.usfm);
		// The deploy notifier derives paths from filenames; enforce the same identity.
		if (
			!chapterInRange(book, chapter) ||
			path !== `/verse/${id.replace(/-(\d+)-(\d+)$/, '/$1/$2')}` ||
			seen.has(data.usfm)
		) {
			throw new Error(`Invalid or duplicate verse explanation identity: ${id} (${data.usfm})`);
		}
		seen.add(data.usfm);
	}
	return briefs;
}

export async function verseBriefFor(usfm: string) {
	const brief = (await listVerseBriefs()).find((entry) => entry.data.usfm === usfm);
	return brief ? { ...brief.data, html: await marked.parse(brief.body) } : null;
}
