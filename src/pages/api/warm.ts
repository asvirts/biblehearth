import type { APIRoute } from 'astro';
import { CRON_SECRET } from 'astro:env/server';
import { isTripped } from '../../lib/cache/breaker';
import { runtimeGet, runtimeSet } from '../../lib/cache/runtime';
import {
	bookSlugFromUsfm,
	chapterUsfm,
	isNumericChapter,
	usfmFromBookSlug,
} from '../../lib/bible/usfm';
import {
	getBibleIndex,
	getDefaultVersion,
	getPassageHtml,
	listVersions,
} from '../../lib/youversion/api';

/**
 * Keeps the passage cache warm ahead of the crawlers.
 *
 * The site survives a rate-limited upstream by serving a cached value, which
 * works for every URL except the ones nobody has asked for yet. A crawler
 * working through the sitemap asks for precisely those: on 2026-08-18 a deploy
 * landed at 16:28Z, purging the CDN, and Ahrefs began a full crawl at 16:44Z.
 * All ~2,000 requests reached the function cold, the app key was throttled, and
 * 1,231 of the 1,255 URLs in the Bible sitemap came back 503 — a cache that
 * only fills on demand cannot be warm the one time it matters.
 *
 * So it is filled on a schedule instead, slowly, through the same functions the
 * pages call. Same cache keys, so a warmed chapter is a chapter the reader page
 * never has to fetch.
 */

/**
 * Chapters per run. With the every-10-minutes schedule in vercel.json this
 * sweeps all 1,189 chapters of the default version in about 17 hours — inside
 * the 24-hour point where entries go stale, and far inside the eight days they
 * stay usable — at a cost of roughly one upstream call a minute.
 */
const CHAPTERS_PER_RUN = 12;

/**
 * Wall-clock ceiling, well under the function limit. A run that is going slowly
 * because the upstream is slow should stop early and leave the rest to the next
 * one; nothing here is worth holding a function open for.
 */
const BUDGET_MS = 30_000;

const CURSOR_KEY = 'warm:cursor';

/** Long enough to outlive a gap in the schedule, short enough to self-heal. */
const CURSOR_TTL_SECONDS = 7 * 24 * 60 * 60;

type BibleIndexOf = Awaited<ReturnType<typeof getBibleIndex>>;

async function readCursor(): Promise<number> {
	const raw = await runtimeGet(CURSOR_KEY);
	const value =
		typeof raw === 'object' && raw !== null && 'at' in raw
			? Number((raw as { at: unknown }).at)
			: 0;
	return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

/**
 * Every chapter the Bible sitemap submits, in a stable order.
 *
 * Stable is the point: the cursor is an offset into this list, so a position
 * has to mean the same chapter from one run to the next.
 */
function chapterTargets(index: BibleIndexOf): string[] {
	const targets: string[] = [];

	for (const book of index.books) {
		// Mirrors the sitemap's own filter: a book we cannot route is a book we
		// never serve, so warming it would spend a call on nothing.
		if (usfmFromBookSlug(bookSlugFromUsfm(book.id)) === null) {
			continue;
		}

		for (const chapter of book.chapters) {
			if (!isNumericChapter(chapter.id)) {
				continue;
			}
			targets.push(chapterUsfm(book.id, chapter.id));
		}
	}

	return targets;
}

export const GET: APIRoute = async ({ request }) => {
	// Unset means unsecured, which for an endpoint that spends API quota is
	// worse than one that does not run at all.
	if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
		return new Response('Unauthorized', { status: 401 });
	}

	const started = Date.now();

	// The warmer exists to protect the app key, so it is the first thing to
	// stand down when the key is already in trouble. The cursor stays put and
	// the next run picks up where this one would have started.
	if (await isTripped()) {
		return Response.json({ ok: true, skipped: 'breaker-open', warmed: 0 });
	}

	let versionId: number;
	let index: BibleIndexOf;
	try {
		// Warming these two matters on its own: every reader page needs the
		// catalog and the index, so they are the entries whose expiry is felt
		// site-wide rather than on one URL.
		const [version] = await Promise.all([getDefaultVersion(), listVersions()]);
		if (!version) {
			return Response.json({ ok: false, error: 'no-default-version' }, { status: 503 });
		}
		versionId = version.id;
		index = await getBibleIndex(versionId);
	} catch {
		return Response.json({ ok: false, error: 'metadata-unavailable' }, { status: 503 });
	}

	const targets = chapterTargets(index);
	if (targets.length === 0) {
		return Response.json({ ok: false, error: 'no-targets' }, { status: 503 });
	}

	const start = (await readCursor()) % targets.length;
	let warmed = 0;
	let failed = 0;
	let offset = 0;

	for (; offset < CHAPTERS_PER_RUN; offset += 1) {
		if (Date.now() - started > BUDGET_MS) {
			break;
		}
		// A 429 part-way through means the rest of this run would only deepen it.
		if (await isTripped()) {
			break;
		}

		const usfm = targets[(start + offset) % targets.length];
		if (!usfm) {
			break;
		}

		try {
			// The reader page's own call, with the reader page's own options, so
			// this writes the key that page will read. Drift here would leave a
			// cache that looks full and warms nothing.
			await getPassageHtml(versionId, usfm, { headings: true, notes: true });
			warmed += 1;
		} catch {
			failed += 1;
		}
	}

	runtimeSet(CURSOR_KEY, { at: (start + offset) % targets.length }, CURSOR_TTL_SECONDS);

	return Response.json({
		ok: true,
		version: versionId,
		total: targets.length,
		from: start,
		warmed,
		failed,
		ms: Date.now() - started,
	});
};
