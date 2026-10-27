import { answerRefs } from './paths';
export { answerPath, answerRefs } from './paths';
import { getCollection, type CollectionEntry } from '../content';
import { referenceIndex } from '../bible/refs';

export type Answer = CollectionEntry<'answers'>;

export type AnswerRef = {
	slug: string;
	/** The question as people type it. Used verbatim as the link text. */
	question: string;
};

/** Published answers, newest first. Drafts are excluded from every surface. */
export async function listAnswers(): Promise<Answer[]> {
	const answers = await getCollection('answers', ({ data }) => !data.draft);
	return answers.sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}

/**
 * Every reference an answer cites: the passage under discussion plus the
 * supporting verses attached to each reading.
 *
 * This is the list that feeds both the reverse link index and the verse-hub
 * sitemap seed, so a citation added to the markdown propagates everywhere
 * without a second edit.
 */

/** Reverse index: which answers discuss a given verse or chapter. */
export async function verseAnswerIndex(): Promise<{
	byVerse: Map<string, AnswerRef[]>;
	byChapter: Map<string, AnswerRef[]>;
}> {
	const answers = await listAnswers();
	return referenceIndex(
		answers.map((answer) => ({
			ref: {
				slug: answer.id,
				question: answer.data.question,
			} satisfies AnswerRef,
			usfms: answerRefs(answer),
		})),
		(ref) => ref.slug,
	);
}
