import type { PageContext } from '../../lib/page/types';
import type { BiblePassage, BibleVersion, VOTD } from '@youversion/platform-core';
import { answerPath, listAnswers } from '../../lib/answers';
import { chapterStudyPath, listChapterBriefs } from '../../lib/commentary';
import { parsePassageId } from '../../lib/bible/usfm';
import { chapterPath, versePath, versionPath } from '../../lib/bible/urls';
import { DEGRADED_CACHE_CONTROL, HOME_CACHE_CONTROL, setCacheControl } from '../../lib/http';
import { websiteJsonLd } from '../../lib/seo';
import { hubFigures } from '../../lib/images/hubs';
import { shareCardFromFigure } from '../../lib/images/og';
import {
	displayAbbreviation,
	getDefaultVersion,
	getPassageHtml,
	getVerseOfTheDay,
	listVersions,
	startReadingChapter,
	versionSlug,
} from '../../lib/youversion/api';

/** Project a catalog into the fields the homepage displays, keeping collision-aware URLs. */
export function homeFeaturedVersions(catalog: BibleVersion[]) {
	return catalog.slice(0, 8).map((version) => ({
		id: version.id,
		slug: versionSlug(version, catalog),
		abbreviation: displayAbbreviation(version),
		title: version.localized_title || version.title,
	}));
}

export async function loadHome(context: PageContext) {
	let degraded = false;
	let defaultVersion: BibleVersion | null = null;
	let catalog: BibleVersion[] = [];
	let votd: VOTD | null = null;
	let votdPassage: BiblePassage | null = null;
	let startHref = '/versions';

	try {
		[defaultVersion, catalog] = await Promise.all([getDefaultVersion(), listVersions()]);

		if (defaultVersion) {
			const slug = versionSlug(defaultVersion, catalog.length ? catalog : [defaultVersion]);
			const start = await startReadingChapter(defaultVersion.id);
			startHref = chapterPath(slug, start.bookId, start.chapterId);

			/**
			 * Its own try, because the home page must not be all-or-nothing.
			 *
			 * `votd:day:N` is a new cache key every midnight UTC, which makes it the
			 * one thing here that is reliably cold — and it was cold at the exact
			 * moment a crawl had the app key throttled, so the whole page became an
			 * error message. Nothing else on it depends on the verse: the markup
			 * already renders the panel only when the passage arrived, so a failure
			 * belongs here rather than in the outer catch that replaces the page.
			 */
			try {
				votd = await getVerseOfTheDay();
				if (votd) {
					votdPassage = await getPassageHtml(defaultVersion.id, votd.passage_id, {
						headings: false,
						notes: false,
					});
				}
				if (!votdPassage) degraded = true;
			} catch {
				votd = null;
				votdPassage = null;
				degraded = true;
			}
		} else {
			degraded = true;
		}
	} catch {
		// The site's original study guides and navigation remain useful even if the
		// Scripture service is down. Avoid exposing deployment configuration to readers.
		degraded = true;
	}

	context.response.status = 200;
	setCacheControl(context.response, degraded ? DEGRADED_CACHE_CONTROL : HOME_CACHE_CONTROL);

	const versionLabel = defaultVersion ? displayAbbreviation(defaultVersion) : '';
	const parsedVotd = votd ? parsePassageId(votd.passage_id) : null;
	const votdHref =
		defaultVersion && parsedVotd?.chapter
			? parsedVotd.verse
				? versePath(
						versionSlug(defaultVersion, catalog.length ? catalog : [defaultVersion]),
						parsedVotd.book,
						parsedVotd.chapter,
						parsedVotd.verse,
					)
				: chapterPath(
						versionSlug(defaultVersion, catalog.length ? catalog : [defaultVersion]),
						parsedVotd.book,
						parsedVotd.chapter,
					)
			: startHref;

	// The home page is the strongest internal-link donor on the site, so the
	// editorial pages get a slot here rather than relying on the footer alone.
	const answers = await listAnswers();
	const featured = homeFeaturedVersions(catalog);

	/**
	 * The briefed chapter studies, which had no link from here at all.
	 *
	 * These are the indexable half of the study section — a chapter without a brief
	 * renders `noindex` and stays out of the sitemap — and every one of them sat
	 * three clicks from the home page, behind /study and then a book page. The
	 * home page is the one URL that will accrue more links than any other, so
	 * spending some of it on the pages carrying our own writing is the cheapest
	 * internal linking available.
	 *
	 * Read from the same `listChapterBriefs()` the sitemap and llms.txt use, so a
	 * new brief appears here the moment it ships and a draft never does. English
	 * only: this is the English home page.
	 *
	 * Capped at eight. Past that this becomes a second copy of /study, which is the
	 * page whose job is the full list — and the cap is why the section ends with a
	 * link to it rather than pretending to be complete.
	 */
	const briefs = (await listChapterBriefs()).slice(0, 8);
	const studies = briefs.map((brief) => {
		const [book, chapter] = brief.data.usfm.split('.');
		return {
			title: brief.data.title,
			href: chapterStudyPath(book ?? '', chapter ?? '1'),
		};
	});

	/**
	 * Static, and that is the fix.
	 *
	 * The title and description here used to be the Verse of the Day: the
	 * description was the psalm's own text, truncated. A description that changes
	 * every midnight cannot rank for anything, because it never describes the same
	 * page twice — and what it described was a passage rather than the site, on the
	 * one URL that will accrue more links than any other. The verse is still the
	 * first thing on the page; it is just no longer what the page claims to be.
	 *
	 * The title spends its 56 characters on the differentiator rather than on
	 * "Read the Bible", which is the query this site cannot win and four platforms
	 * own outright. What is ours is the plain-English writing, so that is what the
	 * title says.
	 */
	const description =
		'Read the Bible free online and find clear, beginner-friendly studies for ' +
		'the chapters and questions people look up most.';

	const figure = hubFigures.home;
	const share = figure ? await shareCardFromFigure(figure) : undefined;

	return {
		site: context.site.toString(),
		degraded,
		defaultVersion: defaultVersion
			? {
					title: defaultVersion.title,
					copyright: defaultVersion.copyright,
					info: defaultVersion.info,
					publisher_url: defaultVersion.publisher_url,
				}
			: null,
		votdPassage: votdPassage
			? { reference: votdPassage.reference, content: votdPassage.content }
			: null,
		startHref,
		versionLabel,
		votdHref,
		answers: answers.map((answer) => ({ id: answer.id, question: answer.data.question })),
		featured,
		studies,
		description,
		figure,
		share,
	};
}
