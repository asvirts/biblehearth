import type { PageContext } from '../../lib/page/types';
import { listAnswers } from '../../lib/answers';
import { TOTAL_CHAPTERS } from '../../lib/bible/chapters';
import { listChapterBriefs, STUDY_HUB_PATH } from '../../lib/commentary';
import { READER_CACHE_CONTROL, setCacheControl } from '../../lib/http';
import { breadcrumbJsonLd, organizationJsonLd, sitePageJsonLd } from '../../lib/seo';
import {
	ABOUT_PATH,
	CONTACT_PATH,
	CORRECTIONS_ANCHOR,
	EDITORIAL_EMAIL,
	SITE_OPERATOR,
} from '../../lib/site';
import { listTopics } from '../../lib/topics';
import { hubFigures } from '../../lib/images/hubs';
import { shareCardFromFigure } from '../../lib/images/og';

export async function loadAbout(context: PageContext) {
	setCacheControl(context.response, READER_CACHE_CONTROL);

	/*
	 * Counted, not written down — from the same three lookups the sitemap and
	 * llms.txt use.
	 *
	 * Every number below is a claim about how much of this site is our own work,
	 * which is the claim this page exists to make. A hand-kept figure would be
	 * wrong by the next brief, and a wrong number here is worse than no number:
	 * it is the one thing on the page a sceptical reader can check in a minute.
	 */
	const [briefs, topics, answers] = await Promise.all([
		listChapterBriefs(),
		listTopics(),
		listAnswers(),
	]);

	const written = briefs.length;
	const unwritten = TOTAL_CHAPTERS - written;
	const count = (value: number) => value.toLocaleString('en-US');

	const title = 'About BibleHearth · Who Writes This and Why';
	const description =
		'Learn who publishes BibleHearth, how its studies are written and reviewed, and how to report a correction.';

	/*
	 * The publisher's own description, which is not the page's.
	 *
	 * `description` above is written for a search result; this one is written for
	 * the entity, and is what other pages inherit when they point at the
	 * Organization node. Keeping them separate stops the About page's meta
	 * description from quietly becoming the site's identity.
	 */
	const publisherDescription =
		'A free Bible site for people who are still getting oriented to Scripture, with licensed translations and clear studies of chapters, topics, and common questions.';

	const figure = hubFigures.about;
	const share = figure ? await shareCardFromFigure(figure) : undefined;

	return {
		site: context.site.toString(),
		topicCount: topics.length,
		answerCount: answers.length,
		written,
		unwritten,
		title,
		description,
		publisherDescription,
		figure,
		share,
	};
}
