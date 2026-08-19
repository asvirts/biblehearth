import type { APIRoute } from 'astro';
import { listAnswers } from '../lib/answers';
import { absoluteUrl, truncate } from '../lib/bible/urls';
import {
	STUDY_HUB_PATH,
	chapterStudyPath,
	listChapterBriefs,
} from '../lib/commentary';
import { MARKDOWN_CACHE_CONTROL } from '../lib/http';
import { listTopics, topicPath } from '../lib/topics';
import { answerPath } from '../lib/answers';

/**
 * The curated index described at https://llmstxt.org.
 *
 * Generated rather than checked in, for the same reason sitemap-commentary.xml
 * is: the list of chapters with original writing on them changes every time
 * someone writes a brief, and a hand-kept copy would be wrong by the second one.
 * `listChapterBriefs()` is the same lookup the sitemap and the study page use,
 * so a chapter appears here, becomes indexable, and gains a markdown twin on the
 * same commit — there is no third place to remember.
 *
 * Deliberately not a sitemap in disguise. The site routes some 1,180 chapter
 * URLs and roughly 31,000 verse hubs; llms.txt is for the handful of pages
 * where the substance is ours, which today is 33 of them. Everything else stays
 * reachable through the hubs in `## Optional`.
 *
 * Links point at the `.md` twins so an agent that follows one gets the writing
 * without a second request or a pass through the page furniture.
 */
export const GET: APIRoute = async ({ site }) => {
	const [briefs, topics, answers] = await Promise.all([
		listChapterBriefs(),
		listTopics(),
		listAnswers(),
	]);

	const md = (path: string) => `${absoluteUrl(site, path)}.md`;
	const entry = (label: string, url: string, note: string) =>
		`- [${label}](${url}): ${truncate(note, 170)}`;

	const body = [
		'# BibleHearth',
		'',
		'> Free Bible reading and Bible study written for people in their first year of reading it: the full text of the Bible in nineteen English translations, alongside original plain-English writing on chapters, topics, and the questions people actually ask.',
		'',
		'Two kinds of page live here, and only one of them is ours. The reader under',
		'/bible/ serves Scripture licensed from its publishers; it is not reproduced as',
		'markdown anywhere on this site, and each translation renders the copyright',
		'notice its publisher requires beside the text.',
		'',
		'Everything listed below is original writing. Each link points to a markdown',
		'twin — the page in its own words, with quoted Scripture replaced by links to',
		'the verse on the site. Drop the `.md` for the canonical HTML page; the twins',
		'are served `noindex` so they never compete with it.',
		'',
		'The writing assumes nothing. No church word is used before it is explained,',
		'and every page states plainly what its passage is routinely made to say and',
		'does not.',
		'',
		'## Chapter studies',
		'',
		...briefs.map((brief) => {
			const [book = '', chapter = '1'] = brief.data.usfm.split('.');
			return entry(
				brief.data.title,
				md(chapterStudyPath(book, chapter)),
				brief.data.shortAnswer,
			);
		}),
		'',
		'## Topics',
		'',
		...topics.map((topic) =>
			entry(
				`Bible verses about ${topic.data.title.toLowerCase()}`,
				md(topicPath(topic.id)),
				topic.data.shortAnswer,
			),
		),
		'',
		'## Questions',
		'',
		...answers.map((answer) =>
			entry(
				answer.data.question,
				md(answerPath(answer.id)),
				answer.data.shortAnswer,
			),
		),
		'',
		'## Optional',
		'',
		entry(
			'Read the Bible',
			absoluteUrl(site, '/bible'),
			'The reader. Nineteen English translations, book and chapter indexes, and a page per verse. Licensed text, so there is no markdown twin.',
		),
		entry(
			'Study index',
			absoluteUrl(site, STUDY_HUB_PATH),
			'Every book of the Bible, linking to a page for each of its chapters. Chapters without original writing are noindex and have no twin.',
		),
		entry(
			'Translations',
			absoluteUrl(site, '/versions'),
			'Which English translations are available, who publishes each, and how they differ.',
		),
		entry(
			'Verse of the Day',
			absoluteUrl(site, '/verse-of-the-day'),
			'Changes daily.',
		),
		entry(
			'Attributions and licences',
			absoluteUrl(site, '/attributions'),
			'Every source reproduced or linked here, who holds it, and under what licence.',
		),
		entry(
			'Sitemap index',
			absoluteUrl(site, '/sitemap.xml'),
			'The full set of URLs the site submits for indexing, which is a much larger list than this one.',
		),
		'',
	].join('\n');

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': MARKDOWN_CACHE_CONTROL,
		},
	});
};
