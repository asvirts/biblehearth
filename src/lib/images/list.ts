import { answerPath, listAnswers } from '../answers';
import { chapterStudyPath, listChapterBriefs } from '../commentary';
import { listTopics, topicPath } from '../topics';
import { HUB_PAGES, hubFigures, type HubId } from './hubs';
import type { EditorialFigure } from './types';

export type AttributedFigure = {
	pageName: string;
	pagePath: string;
	figure: EditorialFigure;
};

/**
 * Every figure on the site, for the attributions page.
 *
 * Built from the same collections the pages use, plus any hub assets, so
 * a credit cannot live on /attributions and nowhere else, or the other way
 * round.
 */
export async function listAttributedFigures(): Promise<AttributedFigure[]> {
	const [chapters, topics, answers] = await Promise.all([
		listChapterBriefs(),
		listTopics(),
		listAnswers(),
	]);

	const hubs: AttributedFigure[] = (Object.keys(HUB_PAGES) as HubId[]).flatMap(
		(id) => {
			const figure = hubFigures[id];
			return figure
				? [
						{
							pageName: HUB_PAGES[id].name,
							pagePath: HUB_PAGES[id].path,
							figure,
						},
					]
				: [];
		},
	);

	const items: AttributedFigure[] = [
		...hubs,
		...chapters
			.filter((brief) => brief.data.figure)
			.map((brief) => {
				const [book = '', chapter = ''] = brief.data.usfm.split('.');
				return {
					pageName: brief.data.title,
					pagePath: chapterStudyPath(book, chapter),
					figure: brief.data.figure as EditorialFigure,
				};
			}),
		...topics
			.filter((topic) => topic.data.figure)
			.map((topic) => ({
				pageName: `Bible verses about ${topic.data.title.toLowerCase()}`,
				pagePath: topicPath(topic.id),
				figure: topic.data.figure as EditorialFigure,
			})),
		...answers
			.filter((answer) => answer.data.figure)
			.map((answer) => ({
				pageName: answer.data.question,
				pagePath: answerPath(answer.id),
				figure: answer.data.figure as EditorialFigure,
			})),
	];

	return items;
}
