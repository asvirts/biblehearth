import type { PageContext } from '../../lib/page/types';
import type { BiblePassage, BibleVersion } from '@youversion/platform-core';
import { getEntry } from '../../lib/content';
import { marked } from 'marked';
import { bookSlugFromUsfm } from '../../lib/bible/usfm';
import { loadPassages } from '../../lib/bible/passages';
import { formatReference } from '../../lib/bible/refs';
import { truncateWords } from '../../lib/bible/text';
import { absoluteUrl, chapterPath } from '../../lib/bible/urls';
import { topicStudies } from '../../lib/topics/studies';
import {
	DEGRADED_CACHE_CONTROL,
	READER_CACHE_CONTROL,
	setCacheControl,
	setLastModified,
} from '../../lib/http';
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, itemListJsonLd } from '../../lib/seo';
import { articleShareFields, shareCardFromFigure } from '../../lib/images/og';
import type { EditorialFigure } from '../../lib/images/types';
import { listTopics, topicPath, topicVerseCount, topicVerses } from '../../lib/topics';
import {
	errorStatus,
	getDefaultVersion,
	listVersions,
	versionSlug,
} from '../../lib/youversion/api';

export async function loadTopicDetail(context: PageContext) {
	const slug = context.params.slug;
	if (!slug) {
		return context.notFound();
	}

	const topic = await getEntry('topics', slug);
	if (!topic || topic.data.draft) {
		return context.notFound();
	}

	const bodyHtml = await marked.parse(topic.body ?? '');

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
			({ passages, failed: failedPassages } = await loadPassages(
				version.id,
				topicVerses(topic).map((verse) => verse.usfm),
			));
		}
	} catch (error) {
		upstreamStatus = errorStatus(error);
	}

	/**
	 * A throttled upstream costs this page its verse text and nothing else.
	 *
	 * Everything that makes this page worth indexing is already in hand before the
	 * first upstream call: the short answer, the themed groups and their
	 * rationales, the per-verse glosses, the misreadings section, the FAQ, and the
	 * prose from `src/content/topics`. That is a complete article, and the reader
	 * gets it along with a `StatusMessage` naming what is absent.
	 *
	 * So this returns 200. Serving 503 threw the article away over a missing
	 * quotation, and did it to the handful of URLs carrying the only original
	 * writing on the site — teaching Googlebot that precisely those pages are
	 * unreliable, at the moment a crawl was already in progress. There is no
	 * condition under which this page has nothing on it, which is what a 503 would
	 * have to mean; a topic that does not exist is a 404 above, and one whose entry
	 * loaded has its whole argument.
	 *
	 * The TTL carries the honesty instead. See DEGRADED_CACHE_CONTROL: five minutes
	 * rather than a day, so the page repairs itself about when the upstream does.
	 *
	 * Failed passages count as well as a failed catalogue. The version and the
	 * catalogue are cached for a week past their refresh point, so they still load
	 * during a throttle while every uncached passage does not — which left a page
	 * with no verses on it looking healthy, and cached for a day.
	 */
	const degraded = upstreamStatus !== 200 || !version || failedPassages > 0;
	setCacheControl(context.response, degraded ? DEGRADED_CACHE_CONTROL : READER_CACHE_CONTROL);
	// The editorial date is the page's own and does not depend on the upstream.
	setLastModified(context.response, topic.data.reviewedAt);

	/**
	 * Single verses link to the version-agnostic hub — that is the indexable page
	 * for a reference, and it closes the loop back into every translation.
	 * Ranges have no hub, so they link to the chapter.
	 */
	function readerHref(usfm: string): string {
		const [book, chapter, verse] = usfm.split('.');
		if (!book || !chapter) {
			return '/versions';
		}
		if (verse && !verse.includes('-')) {
			return `/verse/${bookSlugFromUsfm(book)}/${chapter}/${verse}`;
		}
		/**
		 * The chapter route needs a version slug, and this page now renders its whole
		 * argument when the upstream is down — at which point there is no slug to
		 * build with and `chapterPath` yields `/bible//JHN/3`. A double slash is a
		 * link to a 404 that a crawler will still follow and report. Sending those
		 * links to /versions beats emitting it, which is what the answer pages
		 * already do.
		 */
		return readerSlug ? chapterPath(readerSlug, book, chapter) : '/versions';
	}

	const reference = formatReference;

	const verseCount = topicVerseCount(topic);
	const canonicalPath = topicPath(topic.id);
	const title = `${verseCount} Bible Verses About ${topic.data.title}, Grouped and Explained`;
	/**
	 * The visible `<h1>`, which is not the `<title>`.
	 *
	 * `headline` in an `Article` node means the article's headline, and Google's
	 * structured-data guidance is that it must match what the page displays. The
	 * `<title>` is written for a SERP line — it carries the count and the
	 * "Grouped and Explained" qualifier because that is what earns the click — and
	 * the `<h1>` is written for someone already reading. Passing the `<title>` as
	 * `headline` described a heading this page has never rendered.
	 *
	 * One constant feeding both the markup and the JSON-LD, so they cannot drift.
	 */
	const headline = `Bible Verses About ${topic.data.title}`;
	const description = truncateWords(
		`${verseCount} Bible verses about ${topic.data.title.toLowerCase()}, grouped by theme with plain-English context for each passage: ${topic.data.groups
			.map((group) => group.heading.toLowerCase())
			.slice(0, 2)
			.join('; ')}.`,
		155,
	);

	const allTopics = await listTopics();
	const relatedTopics = topic.data.related
		.map((ref) => allTopics.find((item) => item.id === ref.id))
		.filter((item): item is (typeof allTopics)[number] => Boolean(item));

	const relatedStudies = await topicStudies(topic);

	const reviewed = topic.data.reviewedAt.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
	});

	const share = topic.data.figure ? await shareCardFromFigure(topic.data.figure) : undefined;

	return {
		site: context.site.toString(),
		topic,
		version,
		readerSlug,
		passages,
		degraded,
		canonicalPath,
		title,
		headline,
		description,
		relatedTopics: relatedTopics.map((item) => ({ id: item.id, data: { title: item.data.title } })),
		relatedStudies,
		reviewed,
		share,
		bodyHtml,
	};
}
