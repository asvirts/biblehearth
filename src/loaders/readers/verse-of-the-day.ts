import type { BiblePassage, BibleVersion, VOTD } from '@youversion/platform-core';
import {
	bookNameForChapter,
	bookSlugFromUsfm,
	isNumericChapter,
	isNumericVerse,
	parsePassageId,
	verseUsfm,
} from '../../lib/bible/usfm';
import { scriptureToPlainText, truncateWords } from '../../lib/bible/text';
import { chapterPath, versePath, versionPath } from '../../lib/bible/urls';
import { HOME_CACHE_CONTROL, setPageHeaders } from '../../lib/http';
import { articleJsonLd, breadcrumbJsonLd, creativeWorkJsonLd } from '../../lib/seo';
import { topicPath, verseTopicIndex } from '../../lib/topics';
import { verseAnswerIndex } from '../../lib/answers';
import {
	BibleUnavailableError,
	displayAbbreviation,
	errorStatus,
	getDefaultVersion,
	getPassageHtml,
	getVerseOfTheDay,
	listVersions,
	versionSlug,
} from '../../lib/youversion/api';
import type { PageContext } from '../../lib/page/types';

/** Loads the VerseOfTheDay view once on the server. */
export async function loadVerseOfTheDay(context: PageContext) {
	/**
	 * The Verse of the Day as its own indexable page.
	 *
	 * The home page already renders today's verse, but a home page cannot rank for
	 * "bible verse of the day" and also be the site's brand page — the title and H1
	 * can only serve one of those. This page owns the query outright, and the home
	 * page links to it rather than competing with it.
	 *
	 * The verse itself rotates, so what makes this rankable is the frame around it:
	 * a stable URL, the reference in context, and links out to the chapter, the
	 * translation comparison, and any topic that cites the verse.
	 */

	const CANONICAL_PATH = '/verse-of-the-day';

	let status = 200;
	let errorTitle = '';
	let errorMessage = '';
	let version: BibleVersion | null = null;
	let votd: VOTD | null = null;
	let passage: BiblePassage | null = null;
	let slug = '';

	try {
		const [defaultVersion, catalog] = await Promise.all([getDefaultVersion(), listVersions()]);
		version = defaultVersion;

		if (version) {
			slug = versionSlug(version, catalog.length ? catalog : [version]);
			votd = await getVerseOfTheDay();
			if (votd) {
				passage = await getPassageHtml(version.id, votd.passage_id, {
					headings: false,
					notes: false,
				});
			}
		}
	} catch (error) {
		status = errorStatus(error);
		errorTitle = 'The verse of the day is temporarily unavailable';
		errorMessage =
			error instanceof BibleUnavailableError ? error.message : 'Please try again in a moment.';
	}

	context.response.status = status;
	setPageHeaders(context.response, status, HOME_CACHE_CONTROL);

	const parsed = votd ? parsePassageId(votd.passage_id) : null;
	const bookUsfm = parsed?.book ?? null;
	const chapterId = parsed?.chapter && isNumericChapter(parsed.chapter) ? parsed.chapter : null;

	/**
	 * The calendar cites ranges as often as single verses (`EPH.4.2-3`), and the
	 * reader routes only accept a single numeric verse. Anchor every link on the
	 * first verse of the range rather than dropping the links entirely.
	 */
	const anchorVerse = (() => {
		const first = parsed?.verse?.split('-')[0];
		return first && isNumericVerse(first) ? first : null;
	})();

	const abbreviation = version ? displayAbbreviation(version) : '';
	const reference =
		passage?.reference ??
		(bookUsfm && chapterId
			? `${bookNameForChapter(bookUsfm)} ${chapterId}${parsed?.verse ? `:${parsed.verse}` : ''}`
			: '');

	const chapterHref = bookUsfm && chapterId && slug ? chapterPath(slug, bookUsfm, chapterId) : null;
	const verseHref =
		bookUsfm && chapterId && anchorVerse && slug
			? versePath(slug, bookUsfm, chapterId, anchorVerse)
			: null;
	const compareHref =
		bookUsfm && chapterId && anchorVerse
			? `/verse/${bookSlugFromUsfm(bookUsfm)}/${chapterId}/${anchorVerse}`
			: null;

	const [{ byVerse: topicsByVerse }, { byVerse: answersByVerse }] = await Promise.all([
		verseTopicIndex(),
		verseAnswerIndex(),
	]);
	const todayUsfm =
		bookUsfm && chapterId && anchorVerse ? verseUsfm(bookUsfm, chapterId, anchorVerse) : null;
	const relatedTopics = todayUsfm ? (topicsByVerse.get(todayUsfm) ?? []) : [];
	const relatedAnswers = todayUsfm ? (answersByVerse.get(todayUsfm) ?? []) : [];

	// UTC, because `getVerseOfTheDay` picks the day from the UTC day-of-year. A
	// local-time label would name the wrong day for part of every day.
	const now = new Date();
	const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const dateLabel = dayStart.toLocaleDateString('en-US', {
		timeZone: 'UTC',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});

	const verseText = passage ? scriptureToPlainText(passage.content) : '';
	/**
	 * Query first, then the reference, and nothing else. Bing reports a title over
	 * ~65 characters as an error, and appending the verse cost more than it bought:
	 * a 40-character fragment ending in an ellipsis ("From the rising of the sun to
	 * the…") is not a phrase anyone searches for, and the same words already read as
	 * a sentence in the description below. The reference is what makes the title
	 * change daily, which is the only freshness signal this page needs.
	 */
	const title = reference ? `Bible Verse of the Day — ${reference}` : 'Bible Verse of the Day';
	const description =
		reference && verseText
			? truncateWords(
					`Today's Bible verse of the day is ${reference}${abbreviation ? ` (${abbreviation})` : ''}: ${verseText}`,
					155,
				)
			: 'A new Bible verse every day, with the full chapter for context and the same verse compared across English translations.';

	return {
		CANONICAL_PATH,
		status,
		errorTitle,
		errorMessage,
		version,
		passage,
		slug,
		bookUsfm,
		chapterId,
		abbreviation,
		reference,
		chapterHref,
		verseHref,
		compareHref,
		relatedTopics,
		relatedAnswers,
		dayStart,
		dateLabel,
		title,
		description,
		site: context.site.href,
	};
}
