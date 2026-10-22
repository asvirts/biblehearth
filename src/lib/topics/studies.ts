import { chapterBriefIndex, chapterStudyPath } from '../commentary';
import { topicVerses, type Topic } from './index';

/** Published original studies, in citation order, shared by HTML and markdown. */
export async function topicStudies(topic: Topic) {
	const briefs = await chapterBriefIndex();
	const citedChapters = new Set(
		topicVerses(topic).map(({ usfm }) => usfm.split('.').slice(0, 2).join('.')),
	);
	return [...citedChapters].flatMap((usfm) => {
		const brief = briefs.get(usfm);
		const [book, chapter] = usfm.split('.');
		if (!brief || !book || !chapter) return [];
		return [{ title: brief.data.title, href: chapterStudyPath(book, chapter) }];
	}).slice(0, 4);
}
