import type { APIRoute } from 'astro';
import { briefedChapters, STUDY_HUB_PATH } from '../lib/commentary';
import { LOCALES } from '../lib/i18n/locales';
import {
	latestDate,
	pageSitemapPaths,
	urlsetXmlWithLastmod,
	xmlResponse,
} from '../lib/sitemap';
import { listVersions, versionSlug } from '../lib/youversion/api';

/**
 * `/study` is the only URL here with a date it can defend.
 *
 * The hub lists the briefed chapters, so it changed when the newest brief did.
 * Everything else in this sitemap is hand-written — `/about`, `/privacy`, the
 * home page — and edited in git, which nothing at runtime can see. The
 * available substitutes are all worse than silence: the deploy time would
 * announce that all nine pages changed on every deploy, and a hardcoded date
 * would rot the first time somebody edited one without touching it.
 *
 * `/verse-of-the-day` is the tempting exception, since its passage really is
 * new each midnight UTC. It stays undated anyway: a daily lastmod on a page
 * whose whole body is a licensed passage invites a crawl that spends a metered
 * fetch to re-read text we cannot serve as text, every day, forever.
 */
async function studyLastmod(): Promise<Date | undefined> {
	const perLocale = await Promise.all(
		LOCALES.map((locale) => briefedChapters(locale)),
	);
	return latestDate(perLocale.flat().map((chapter) => chapter.reviewedAt));
}

export const GET: APIRoute = async ({ site, request }) => {
	let slugs: string[] = [];
	try {
		const versions = await listVersions();
		slugs = versions.map((version) => versionSlug(version, versions));
	} catch {
		// The hand-written pages need no catalogue, so a throttled upstream costs
		// this sitemap its version pages and nothing else.
	}

	const reviewed = await studyLastmod().catch(() => undefined);

	return xmlResponse(
		urlsetXmlWithLastmod(
			site,
			pageSitemapPaths(slugs).map((path) => ({
				path,
				lastmod: path === STUDY_HUB_PATH ? reviewed : undefined,
			})),
		),
		request,
	);
};
