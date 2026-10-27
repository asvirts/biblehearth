import type { PageContext } from '../../lib/page/types';
import { HOME_CACHE_CONTROL, setCacheControl } from '../../lib/http';
import { breadcrumbJsonLd, itemListJsonLd } from '../../lib/seo';
import { absoluteUrl } from '../../lib/bible/urls';
import { listTopics, topicPath, topicVerseCount } from '../../lib/topics';
import { hubFigures } from '../../lib/images/hubs';
import { shareCardFromFigure } from '../../lib/images/og';

export async function loadTopicsIndex(context: PageContext) {
	setCacheControl(context.response, HOME_CACHE_CONTROL);

	const topics = await listTopics();
	const names = topics
		.slice(0, 3)
		.map((topic) => topic.data.title)
		.join(', ');

	const figure = hubFigures.topics;
	const share = figure ? await shareCardFromFigure(figure) : undefined;

	return {
		site: context.site.toString(),
		topics: topics.map((topic) => ({
			id: topic.id,
			title: topic.data.title,
			shortAnswer: topic.data.shortAnswer,
			aliases: topic.data.aliases,
			verseCount: topicVerseCount(topic),
			groupCount: topic.data.groups.length,
		})),
		names,
		figure,
		share,
	};
}
