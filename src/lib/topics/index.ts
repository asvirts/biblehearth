import { getCollection, type CollectionEntry } from 'astro:content';

export type Topic = CollectionEntry<'topics'>;

export type TopicVerse = {
	usfm: string;
	gloss: string;
	groupId: string;
};

export type TopicRef = {
	slug: string;
	title: string;
};

export function topicPath(slug: string): string {
	return `/topics/${slug}`;
}

/** Published topics, alphabetical. Drafts are excluded from every surface. */
export async function listTopics(): Promise<Topic[]> {
	const topics = await getCollection('topics', ({ data }) => !data.draft);
	return topics.sort((a, b) => a.data.title.localeCompare(b.data.title));
}

export function topicVerses(topic: Topic): TopicVerse[] {
	return topic.data.groups.flatMap((group) =>
		group.verses.map((verse) => ({
			usfm: verse.usfm,
			gloss: verse.gloss,
			groupId: group.id,
		})),
	);
}

export function topicVerseCount(topic: Topic): number {
	return topic.data.groups.reduce(
		(total, group) => total + group.verses.length,
		0,
	);
}

/**
 * Expand a reference into the individual verses it covers.
 *
 * `PHP.4.6-7` → `PHP.4.6`, `PHP.4.7`. A chapter-only reference (`PHP.4`)
 * expands to itself, since we cannot know its length without the index.
 */
export function expandUsfm(usfm: string): string[] {
	const parts = usfm.split('.');
	const [book, chapter, verse] = parts;
	if (!book || !chapter || !verse) {
		return [usfm];
	}

	const range = verse.split('-');
	const start = Number(range[0]);
	const end = range[1] === undefined ? start : Number(range[1]);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
		return [usfm];
	}

	const out: string[] = [];
	for (let n = start; n <= end && out.length < 200; n += 1) {
		out.push(`${book}.${chapter}.${n}`);
	}
	return out;
}

export function chapterOf(usfm: string): string {
	const [book, chapter] = usfm.split('.');
	return book && chapter ? `${book}.${chapter}` : usfm;
}

/**
 * Reverse index: which topics cite a given verse or chapter.
 *
 * This is the half of the internal-link graph that turns leaf reader pages from
 * crawl-budget consumers into topic-link donors. It must be computed, never
 * hand-maintained.
 */
export async function verseTopicIndex(): Promise<{
	byVerse: Map<string, TopicRef[]>;
	byChapter: Map<string, TopicRef[]>;
}> {
	const topics = await listTopics();
	const byVerse = new Map<string, TopicRef[]>();
	const byChapter = new Map<string, TopicRef[]>();

	const push = (map: Map<string, TopicRef[]>, key: string, ref: TopicRef) => {
		const existing = map.get(key);
		if (!existing) {
			map.set(key, [ref]);
			return;
		}
		if (!existing.some((item) => item.slug === ref.slug)) {
			existing.push(ref);
		}
	};

	for (const topic of topics) {
		const ref: TopicRef = { slug: topic.id, title: topic.data.title };
		for (const { usfm } of topicVerses(topic)) {
			for (const single of expandUsfm(usfm)) {
				push(byVerse, single, ref);
				push(byChapter, chapterOf(single), ref);
			}
		}
	}

	return { byVerse, byChapter };
}

/**
 * A human-readable reference for a USFM id, using the app's book names.
 * `PHP.4.6-7` → `Philippians 4:6-7`.
 */
export function formatReference(
	usfm: string,
	bookName: (id: string) => string,
): string {
	const [book, chapter, verse] = usfm.split('.');
	if (!book) {
		return usfm;
	}
	const name = bookName(book);
	if (!chapter) {
		return name;
	}
	return verse ? `${name} ${chapter}:${verse}` : `${name} ${chapter}`;
}
