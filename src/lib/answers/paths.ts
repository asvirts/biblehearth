import type { Answer } from './index';
export function answerPath(slug: string): string {
	return `/answers/${slug}`;
}
export function answerRefs(answer: Answer): string[] {
	return [
		answer.data.anchor.chapter,
		answer.data.anchor.passage,
		...answer.data.views.flatMap((view) => view.verses.map((verse) => verse.usfm)),
	];
}
