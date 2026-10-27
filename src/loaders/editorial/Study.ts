import type { PageContext } from '../../lib/page/types';
import {
	NEW_TESTAMENT_BOOKS,
	OLD_TESTAMENT_BOOKS,
	TOTAL_CHAPTERS,
	chapterCount,
} from '../../lib/bible/chapters';
import { bookNameFromUsfm } from '../../lib/bible/usfm';
import {
	COMMENTARY_SOURCES,
	STUDY_HUB_PATH,
	bookStudyPath,
	chapterStudyPath,
	listChapterBriefs,
} from '../../lib/commentary';
import { READER_CACHE_CONTROL, setCacheControl } from '../../lib/http';
import { breadcrumbJsonLd, itemListJsonLd } from '../../lib/seo';
import { absoluteUrl } from '../../lib/bible/urls';
import { hubFigures } from '../../lib/images/hubs';
import { shareCardFromFigure } from '../../lib/images/og';

export async function loadStudy(context: PageContext) {
	setCacheControl(context.response, READER_CACHE_CONTROL);

	const briefs = await listChapterBriefs();

	/**
	 * What this hub can honestly claim, which is two different numbers.
	 *
	 * The description used to read "Browse all 1,189 chapters of the Bible, with
	 * clear chapter studies and notes from three free commentaries" — which a
	 * reader and a snippet both take as 1,189 chapter studies. There are far fewer.
	 * 1,189 is how many chapters you can *reach* from here; `briefs.length` is how
	 * many have writing of our own on them, and the rest are `noindex` pages of
	 * republished commentary that four larger sites already mirror.
	 *
	 * Both numbers stated, neither standing in for the other. The written count is
	 * read from the same `listChapterBriefs()` the sitemap uses, so it cannot drift
	 * from what the page below actually lists — which is the other half of the
	 * problem with a hardcoded claim: it would have been wrong again the next time
	 * somebody shipped a brief.
	 */
	const written = briefs.length;
	const allChapters = TOTAL_CHAPTERS.toLocaleString('en-US');
	const title = 'Bible Commentary and Chapter Studies | BibleHearth';
	const description = written
		? `All ${allChapters} chapters of the Bible, browsable by book. ${written} ${written === 1 ? 'has' : 'have'} a study written in plain English; every chapter page carries notes from three free commentaries.`
		: `All ${allChapters} chapters of the Bible, browsable by book, each with notes from three free commentaries.`;

	/** The same two numbers in the lede's own voice. Empty while nothing is written. */
	const writtenSentence = written
		? `${written} ${written === 1 ? 'chapter has' : 'chapters have'} a study written by us as well: a walk through the chapter in order, in plain English, with the unfamiliar words explained. Those are listed first below.`
		: '';

	const books = [
		{ heading: 'Old Testament', ids: OLD_TESTAMENT_BOOKS },
		{ heading: 'New Testament', ids: NEW_TESTAMENT_BOOKS },
	];

	const figure = hubFigures.study;
	const share = figure ? await shareCardFromFigure(figure) : undefined;

	return {
		site: context.site.toString(),
		briefs: briefs.map((brief) => ({
			id: brief.id,
			title: brief.data.title,
			usfm: brief.data.usfm,
		})),
		title,
		description,
		writtenSentence,
		books,
		figure,
		share,
	};
}
