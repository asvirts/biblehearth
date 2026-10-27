import type { PageContext } from '../../lib/page/types';
import type { BiblePassage, BibleVersion } from '@youversion/platform-core';
import { getEntry } from '../../lib/content';
import { marked } from 'marked';
import { answerPath, answerRefs, listAnswers } from '../../lib/answers';
import { loadPassages } from '../../lib/bible/passages';
import { expandUsfm, formatReference } from '../../lib/bible/refs';
import { truncateWords } from '../../lib/bible/text';
import { bookSlugFromUsfm } from '../../lib/bible/usfm';
import { absoluteUrl, chapterPath } from '../../lib/bible/urls';
import {
	DEGRADED_CACHE_CONTROL,
	READER_CACHE_CONTROL,
	setCacheControl,
	setLastModified,
} from '../../lib/http';
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, itemListJsonLd } from '../../lib/seo';
import { articleShareFields, shareCardFromFigure } from '../../lib/images/og';
import type { EditorialFigure } from '../../lib/images/types';
import { listTopics, topicPath } from '../../lib/topics';
import {
	displayAbbreviation,
	errorStatus,
	getDefaultVersion,
	listVersions,
	versionSlug,
} from '../../lib/youversion/api';

export async function loadAnswerDetail(context: PageContext) {
	const slug = context.params.slug;
	if (!slug) {
		return context.notFound();
	}

	const answer = await getEntry('answers', slug);
	if (!answer || answer.data.draft) {
		return context.notFound();
	}

	const bodyHtml = await marked.parse(answer.body ?? '');
	const { anchor, views } = answer.data;

	let version: BibleVersion | null = null;
	let readerSlug = '';
	let passages = new Map<string, BiblePassage | null>();
	let failedPassages = 0;
	let upstreamStatus = 200;

	try {
		const [defaultVersion, catalog] = await Promise.all([getDefaultVersion(), listVersions()]);
		version = defaultVersion;
		if (version) {
			readerSlug = versionSlug(version, catalog.length ? catalog : [version]);
			({ passages, failed: failedPassages } = await loadPassages(version.id, answerRefs(answer)));
		}
	} catch (error) {
		upstreamStatus = errorStatus(error);
	}

	/**
	 * 200 with a short TTL, not 503. Same reasoning as the topic pages.
	 *
	 * This page is even more ours than those: the compared readings, the support
	 * and objection under each one, the bottom line, the cautions and the FAQ are
	 * all written here, and the passage is the thing being argued about rather than
	 * the argument. A missing quotation leaves every claim on the page intact, and
	 * `StatusMessage` says which text is absent.
	 *
	 * `DEGRADED_CACHE_CONTROL` is what keeps this from caching a passage-less page
	 * for a day. 503 is reserved for a page with nothing on it, which this cannot
	 * be — the entry either loaded or 404'd above.
	 *
	 * Failed passages count too, not only a failed catalogue: the catalogue is held
	 * for a week past its refresh point, so during a throttle it still loads while
	 * every uncached passage does not.
	 */
	const degraded = upstreamStatus !== 200 || !version || failedPassages > 0;
	setCacheControl(context.response, degraded ? DEGRADED_CACHE_CONTROL : READER_CACHE_CONTROL);
	setLastModified(context.response, answer.data.reviewedAt);

	/**
	 * Single verses go to the version-agnostic hub; ranges have none, so they fall
	 * back to the chapter. Same rule the topic pages use.
	 *
	 * The chapter route needs a version slug, and this page still renders its whole
	 * argument when the upstream is down — at which point there is no slug to
	 * build with. Sending those links to /versions beats emitting `/bible//...`.
	 */
	function readerHref(usfm: string): string {
		const [book, chapter, verse] = usfm.split('.');
		if (!book || !chapter) {
			return '/versions';
		}
		if (verse && !verse.includes('-')) {
			return `/verse/${bookSlugFromUsfm(book)}/${chapter}/${verse}`;
		}
		return readerSlug ? chapterPath(readerSlug, book, chapter) : '/versions';
	}

	const [anchorBook, anchorChapter] = anchor.chapter.split('.');
	const anchorReference = formatReference(anchor.passage);
	const anchorChapterReference = formatReference(anchor.chapter);
	const anchorChapterHref =
		anchorBook && anchorChapter && readerSlug
			? chapterPath(readerSlug, anchorBook, anchorChapter)
			: '/versions';
	// Every verse in the range gets its own hub link. Those hubs link back here
	// through the reverse index, so the pair reinforces rather than dangles.
	const anchorVerses = expandUsfm(anchor.passage);

	const canonicalPath = answerPath(answer.id);
	const title = answer.data.question;
	// Keep the structured headline aligned with the visible question.
	const headline = answer.data.question;
	const description = truncateWords(answer.data.shortAnswer, 155);

	const citedRefs = views.flatMap((view) => view.verses.map((verse) => verse.usfm));

	const allTopics = await listTopics();
	const relatedTopics = answer.data.relatedTopics
		.map((ref) => allTopics.find((item) => item.id === ref.id))
		.filter((item): item is (typeof allTopics)[number] => Boolean(item));

	const otherAnswers = (await listAnswers()).filter((item) => item.id !== answer.id);

	const reviewed = answer.data.reviewedAt.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
	});

	const share = answer.data.figure ? await shareCardFromFigure(answer.data.figure) : undefined;

	return {
		site: context.site.toString(),
		answer,
		anchor,
		views,
		version,
		readerSlug,
		passages,
		degraded,
		anchorReference,
		anchorChapterReference,
		anchorChapterHref,
		anchorVerses,
		canonicalPath,
		title,
		headline,
		description,
		citedRefs,
		relatedTopics: relatedTopics.map((item) => ({ id: item.id, data: { title: item.data.title } })),
		otherAnswers: otherAnswers.map((item) => ({
			id: item.id,
			data: { question: item.data.question },
		})),
		reviewed,
		share,
		bodyHtml,
	};
}
