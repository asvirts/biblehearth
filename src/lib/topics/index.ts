import { topicVerses } from './paths';
export { topicPath, topicVerses, topicVerseCount } from './paths';
import { getCollection, type CollectionEntry } from '../content';
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

/** Published topics, alphabetical. Drafts are excluded from every surface. */
export async function listTopics(): Promise<Topic[]> {
	const topics = await getCollection('topics', ({ data }) => !data.draft);
	return topics.sort((a, b) => a.data.title.localeCompare(b.data.title));
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
