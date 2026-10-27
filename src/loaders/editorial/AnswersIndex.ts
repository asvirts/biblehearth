import type { PageContext } from '../../lib/page/types';
import { answerPath, listAnswers } from '../../lib/answers';
import { formatReference } from '../../lib/bible/refs';
import { truncateWords } from '../../lib/bible/text';
import { absoluteUrl } from '../../lib/bible/urls';
import { HOME_CACHE_CONTROL, setCacheControl } from '../../lib/http';
import { breadcrumbJsonLd, itemListJsonLd } from '../../lib/seo';
import { hubFigures } from '../../lib/images/hubs';
import { shareCardFromFigure } from '../../lib/images/og';

export async function loadAnswersIndex(context: PageContext) {
	setCacheControl(context.response, HOME_CACHE_CONTROL);

	const answers = await listAnswers();
	// Labels are proper-noun phrases ("Sons of God in Genesis 6"), so they go in
	// the description as written rather than lowercased the way topics are.
	const labels = answers.map((answer) => answer.data.label);

	const figure = hubFigures.answers;
	const share = figure ? await shareCardFromFigure(figure) : undefined;

	return {
		site: context.site.toString(),
		answers: answers.map((answer) => ({
			id: answer.id,
			question: answer.data.question,
			shortAnswer: answer.data.shortAnswer,
			passage: answer.data.anchor.passage,
			viewCount: answer.data.views.length,
			faqCount: answer.data.faqs.length,
		})),
		labels,
		figure,
		share,
	};
}
