import { verseAnswerIndex } from '../../lib/answers';
import { bookStudyPath } from '../../lib/commentary';
import {
	bookNameForChapter,
	bookNameFromUsfm,
	isCanonicalBookSlug,
	isNumericChapter,
	isNumericVerse,
	usfmFromBookSlug,
	verseUsfm,
} from '../../lib/bible/usfm';
import { scriptureToPlainText } from '../../lib/bible/text';
import {
	absoluteUrl,
	chapterPath,
	verseHubPath,
	versePath,
	versionPath,
} from '../../lib/bible/urls';
import {
	breadcrumbJsonLd,
	creativeWorkJsonLd,
	descriptionWithClause,
	itemListJsonLd,
	titleWithClause,
} from '../../lib/seo';
import { topicPath, verseTopicIndex } from '../../lib/topics';
import { displayAbbreviation } from '../../lib/youversion/api';
import { loadVerseHub as loadVerseHubData } from '../../lib/youversion/verse-hub';
import type { PageContext } from '../../lib/page/types';

/** Loads the VerseHub view once on the server. */
export async function loadVerseHub(context: PageContext) {
	const bookSlug = context.params.book;
	const chapterId = context.params.chapter;
	const verseId = context.params.verse;

	if (
		!bookSlug ||
		!chapterId ||
		!verseId ||
		!isNumericChapter(chapterId) ||
		!isNumericVerse(verseId)
	) {
		return context.notFound();
	}

	const bookUsfm = usfmFromBookSlug(bookSlug);
	if (!bookUsfm) {
		return context.notFound();
	}

	const usfm = verseUsfm(bookUsfm, chapterId, verseId);

	/**
	 * The one route where the alias was not merely duplicated but unconsolidated:
	 * `/verse/psa/28/1` and `/verse/psalms/28/1` each pointed their canonical tag
	 * at themselves, so nothing told a crawler the two were one page. These hubs
	 * are also the 594 URLs the site actively submits, which made it the worst
	 * place in the site to leave it.
	 */
	if (!isCanonicalBookSlug(bookSlug, bookUsfm)) {
		const canonical = verseHubPath(usfm);
		if (canonical) {
			return context.redirect(canonical, 301);
		}
	}

	const reference = `${bookNameForChapter(bookUsfm)} ${chapterId}:${verseId}`;

	const { renderings, status, headers } = await loadVerseHubData(bookUsfm, chapterId, verseId);
	if (status === 404) {
		return context.notFound();
	}

	context.response.status = status;
	headers.forEach((value, name) => context.response.headers.set(name, value));

	const primary = renderings[0];
	const verseText = primary ? scriptureToPlainText(primary.passage.content) : '';

	const canonicalPath = `/verse/${bookSlug}/${chapterId}/${verseId}`;
	const translations = renderings.map((item) => displayAbbreviation(item.version));

	const title = renderings.length
		? titleWithClause(reference, `in ${renderings.length} Translations`, verseText)
		: `${reference} — Compare Bible Translations`;

	/**
	 * The verse is what makes this relevant; the list is what makes it different.
	 *
	 * Both have to be here. Leading with the verse alone is what four larger sites
	 * already put in front of this query, and the old string spent its whole budget
	 * doing exactly that: `truncateWords` was applied to the verse and the tail
	 * together, so a long verse ate the entire allowance and the reason to click
	 * never rendered. Isaiah 61:1 ended at "bind up the…" and said nothing about
	 * translations at all. Bounding the lead separately was the right move, but
	 * concatenating it with an unbounded reference, abbreviation list, and chapter
	 * sentence still overran the ~155 characters a result displays — and the
	 * translations, sitting at the end, were the part the cut hid. The chapter
	 * sentence is true of every hub and is the first thing dropped; a long
	 * reference shrinks the lead rather than the list.
	 */
	const description = descriptionWithClause(
		verseText,
		renderings.length
			? `${reference} side by side in ${renderings.length} translations: ${translations.join(', ')}.`
			: `Compare ${reference} across Bible translations on BibleHearth.`,
		renderings.length ? 'Each links to the full chapter.' : '',
	);

	const [{ byVerse: topicsByVerse }, { byVerse: answersByVerse }] = await Promise.all([
		verseTopicIndex(),
		verseAnswerIndex(),
	]);
	const relatedTopics = topicsByVerse.get(usfm) ?? [];
	const relatedAnswers = answersByVerse.get(usfm) ?? [];

	const previousVerse = Number(verseId) > 1 ? String(Number(verseId) - 1) : null;
	const nextVerse = String(Number(verseId) + 1);

	return {
		bookSlug,
		chapterId,
		verseId,
		bookUsfm,
		reference,
		renderings,
		status,
		canonicalPath,
		title,
		description,
		relatedTopics,
		relatedAnswers,
		previousVerse,
		nextVerse,
		site: context.site.href,
	};
}
