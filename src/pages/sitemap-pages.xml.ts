import type { APIRoute } from 'astro';
import { briefedChapters, STUDY_HUB_PATH } from '../lib/commentary';
import { DEFAULT_LOCALE } from '../lib/i18n/locales';
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
 *
 * English only, because `/study` is the English hub. The other 57 locales have
 * their own hub at `studyHubPath(locale)`, submitted by their own locale
 * sitemap, and folding their briefs in here would date this URL from a page it
 * does not contain — a Portuguese brief shipped today would advertise an
 * English hub as changed when nothing on it moved. That is the fabricated
 * freshness signal lib/sitemap.ts refuses everywhere else.
 *
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
	const briefed = await briefedChapters(DEFAULT_LOCALE);
	return latestDate(briefed.map((chapter) => chapter.reviewedAt));
}

export const GET: APIRoute = async ({ request, site }) => {
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
