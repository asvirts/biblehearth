import { getCollection, type CollectionEntry } from 'astro:content';
import { referenceIndex } from '../bible/refs';

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

/** Reverse index: which topics cite a given verse or chapter. */
export async function verseTopicIndex(): Promise<{
	byVerse: Map<string, TopicRef[]>;
	byChapter: Map<string, TopicRef[]>;
}> {
	const topics = await listTopics();
	return referenceIndex(
		topics.map((topic) => ({
			ref: { slug: topic.id, title: topic.data.title } satisfies TopicRef,
			usfms: topicVerses(topic).map((verse) => verse.usfm),
		})),
		(ref) => ref.slug,
	);
}
