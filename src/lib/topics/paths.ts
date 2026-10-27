import type { Topic, TopicVerse } from './index';
export function topicPath(slug: string): string {
	return `/topics/${slug}`;
}
export function topicVerses(topic: Topic): TopicVerse[] {
	return topic.data.groups.flatMap((group) =>
		group.verses.map((verse) => ({ usfm: verse.usfm, gloss: verse.gloss, groupId: group.id })),
	);
}
export function topicVerseCount(topic: Topic): number {
	return topic.data.groups.reduce((total, group) => total + group.verses.length, 0);
}
