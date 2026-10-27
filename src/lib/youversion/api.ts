import { displayAbbreviation, versionSlug, readableChapters } from './display';
export { displayAbbreviation, versionSlug, readableChapters } from './display';
import {
	getAdjacentChapter,
	getHttpStatus,
	type BibleBook,
	type BibleIndex,
	type BibleIndexBook,
	type BiblePassage,
	type BibleVersion,
	type Collection,
	type VOTD,
} from '@youversion/platform-core';
const DEFAULT_BIBLE_ID = Number(process.env.DEFAULT_BIBLE_ID || 111);
import {
	chapterUsfm,
	isIntroChapter,
	isNumericChapter,
	isNumericVerse,
	verseUsfm,
} from '../bible/usfm';
import { isExcludedVersion } from '../bible/catalog';
import { DEFAULT_LOCALE, type Locale } from '../i18n/locales';
import { sanitizePassageHtml } from '../bible/sanitize';
import { lastVerseId, sliceVerse } from '../bible/verses';
import { isTripped, trip } from '../cache/breaker';
import { limitUpstream, UpstreamBusyError } from '../cache/limiter';
import { loadCached, peekCached } from '../cache/store';
import { getBibleClient, PlatformConfigError } from './client';

const VERSION_CACHE_MS = 10 * 60 * 1000;
const INDEX_CACHE_MS = 30 * 60 * 1000;
/**
 * Scripture is immutable, so passages are held far longer than metadata.
 * `soft` is when we try to refresh; `hard` is how long the value stays usable
 * as a fallback when the upstream is failing.
 */
const PASSAGE_CACHE_MS = 24 * 60 * 60 * 1000;
const STALE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const THROTTLED_MESSAGE = 'Too many requests. Please try again shortly.';

export class BibleNotFoundError extends Error {
	constructor(message = 'Bible resource not found') {
		super(message);
		this.name = 'BibleNotFoundError';
	}
}

export class BibleUnavailableError extends Error {
	constructor(message = 'Bible text is temporarily unavailable') {
		super(message);
		this.name = 'BibleUnavailableError';
	}
}

function rethrowPlatformError(error: unknown): never {
	if (
		error instanceof PlatformConfigError ||
		error instanceof BibleNotFoundError ||
		error instanceof BibleUnavailableError
	) {
		throw error;
	}

	const status = getHttpStatus(error);
	if (status === 404 || status === 204) {
		throw new BibleNotFoundError();
	}
	if (status === 401) {
		throw new PlatformConfigError();
	}
	if (status === 429) {
		throw new BibleUnavailableError(THROTTLED_MESSAGE);
	}

	throw new BibleUnavailableError();
}

/**
 * The single door to the upstream API.
 *
 * Every call passes the breaker first, so one 429 stands the whole site down
 * from calling out for a cooldown instead of every request re-spending a limit
 * that is already exhausted. Failing here rather than at the API is what lets
 * `loadCached` fall back to a stale value — and what lets the key recover.
 */
async function withPlatform<T>(operation: () => Promise<T>): Promise<T> {
	if (await isTripped()) {
		throw new BibleUnavailableError(THROTTLED_MESSAGE);
	}

	try {
		return await limitUpstream(operation);
	} catch (error) {
		// A saturated queue is the limiter doing its job, not an upstream fault:
		// nothing was sent, so the breaker must not trip on it. Reported as
		// unavailable so `loadCached` reaches for a stale value the same way.
		if (error instanceof UpstreamBusyError) {
			throw new BibleUnavailableError();
		}
		if (getHttpStatus(error) === 429) {
			trip();
		}
		rethrowPlatformError(error);
	}
}

async function listAllVersions(locale: Locale): Promise<BibleVersion[]> {
	return loadCached(`versions:${locale.code}`, VERSION_CACHE_MS, STALE_GRACE_MS, async () =>
		withPlatform(async () => {
			const client = getBibleClient();
			const versions: BibleVersion[] = [];
			let pageToken: string | undefined;

			do {
				const page: Collection<BibleVersion> = await client.getVersions(
					locale.apiLanguageRange,
					undefined,
					{
						page_size: 99,
						page_token: pageToken,
					},
				);
				versions.push(...page.data);
				pageToken = page.next_page_token ?? undefined;
			} while (pageToken && versions.length < 2000);

			/**
			 * An empty catalog is a failure wearing a 200.
			 *
			 * It has to throw rather than return, because everything
			 * downstream reads an absent version as a missing one:
			 * `resolveVersion` finds no match, returns null, and every
			 * reader page rewrites to /404. Cached — and the envelope holds
			 * for a week past its refresh point — one degraded response
			 * would 404 the entire site until it aged out, which is not a
			 * state that recovers on its own. Thrown, it is just another
			 * unavailable upstream: `loadCached` keeps serving the last
			 * good catalog, and a 503 invites the crawler back.
			 */
			if (versions.length === 0) {
				throw new BibleUnavailableError();
			}

			return versions;
		}),
	);
}

/**
 * The catalog as the site presents it, for one locale.
 *
 * Filtering happens on read, not before caching: the Runtime Cache survives
 * deployments, so filtering at write time would leave a newly excluded version
 * live until the entry happened to expire.
 *
 * Two filters, and which one applies is the locale's decision rather than this
 * function's. English is a blocklist because it was curated down from the
 * twenty versions this key already carried, so naming the rejects was the
 * shorter list. Every other locale is an allowlist of ids, because a locale
 * starting from nothing must not gain ~1,189 crawlable reader pages the day an
 * upstream edition appears in its language.
 */
export async function listVersions(locale: Locale = DEFAULT_LOCALE): Promise<BibleVersion[]> {
	const versions = await listAllVersions(locale);

	if (locale.versionIds === null) {
		return versions.filter((version) => !isExcludedVersion(version));
	}

	const allowed = new Set(locale.versionIds);
	return versions.filter((version) => allowed.has(version.id));
}

/**
 * The abbreviation to show users and to build slugs from.
 *
 * `abbreviation` carries YouVersion's internal edition suffix — NIV11 — but
 * people search "john 3 niv", not "john 3 niv11". `localized_abbreviation` is
 * already the clean public form (NIV) and correctly keeps genuinely distinct
 * editions apart (NASB1995 vs NASB2020), so it is preferred wherever the
 * abbreviation is user-visible.
 */

const SLUG_WITH_ID = /^([a-z0-9]+(?:-[a-z0-9]+)*)-(\d+)$/;

/**
 * A version slug back to the version it names, within one locale.
 *
 * Scoped to a locale rather than global, because the abbreviation is not unique
 * across languages: `nvi` is the Spanish NVI (128), the Portuguese NVI (129)
 * and the Castellano NVI (1637). Resolving globally would make `/es/bible/nvi`
 * and `/pt/bible/nvi` a coin toss between three editions, and the `-{id}`
 * disambiguator would leak into URLs that have a perfectly good unambiguous
 * spelling inside their own locale.
 */
export async function resolveVersion(
	requestedSlug: string,
	locale: Locale = DEFAULT_LOCALE,
): Promise<{ version: BibleVersion; slug: string } | null> {
	// Slugs are built lower-case (see `versionSlug`), so `/bible/NIV` names the same
	// version as `/bible/niv`. Resolving it lets the caller's `resolved.slug !==
	// requestedSlug` check turn it into a 301, where an exact match 404'd it.
	const slug = requestedSlug.toLowerCase();
	const withId = slug.match(SLUG_WITH_ID);
	if (withId) {
		const id = Number(withId[2]);
		const version = await getVersionById(id);
		// An excluded version must 404 here too, or `/bible/tpt-1849` would
		// bypass the catalog filter entirely — and for a translated locale, so
		// must a version this locale does not carry, or `/es/bible/rves-147`
		// would serve a page the allowlist deliberately withheld.
		if (!version || isExcludedVersion(version) || !carries(locale, version)) {
			return null;
		}
		const catalog = await listVersions(locale).catch(() => [version]);
		const catalogVersion = catalog.find((item) => item.id === version.id) ?? version;
		return {
			version: mergeVersionDetails(catalogVersion, version),
			slug: versionSlug(catalogVersion, catalog),
		};
	}

	const catalog = await listVersions(locale);
	const matches = catalog.filter(
		(item) =>
			item.abbreviation.toLowerCase() === slug ||
			item.localized_abbreviation.toLowerCase() === slug,
	);

	if (matches.length === 1 && matches[0]) {
		const selected = matches[0];
		return {
			version: await hydrateVersion(selected),
			slug: versionSlug(selected, catalog),
		};
	}

	return null;
}

export async function getVersionById(id: number): Promise<BibleVersion | null> {
	return loadCached(`version:${id}`, VERSION_CACHE_MS, STALE_GRACE_MS, async () => {
		try {
			return await withPlatform(() => getBibleClient().getVersion(id));
		} catch (error) {
			if (error instanceof BibleNotFoundError) {
				return null;
			}
			throw error;
		}
	});
}

/**
 * The catalogue is sufficient to choose an edition and stable URL, but its
 * version objects may omit publisher copyright. The per-version detail is the
 * authoritative source of attribution, so every text-bearing view needs it.
 * Keep catalogue display identity stable: detail and catalogue localizations can
 * differ, and a metadata refresh must not silently change a public URL.
 */
export function mergeVersionDetails(catalog: BibleVersion, detail: BibleVersion): BibleVersion {
	if (catalog.id !== detail.id)
		throw new BibleUnavailableError('Bible version details are unavailable');
	return {
		...catalog,
		...detail,
		id: catalog.id,
		abbreviation: catalog.abbreviation || detail.abbreviation,
		localized_abbreviation: catalog.localized_abbreviation || detail.localized_abbreviation,
		title: catalog.title || detail.title,
		localized_title: catalog.localized_title || detail.localized_title,
		copyright: detail.copyright || catalog.copyright,
		info: detail.info || catalog.info,
		publisher_url: detail.publisher_url || catalog.publisher_url,
	};
}

export async function hydrateVersion(
	catalog: BibleVersion,
	loadDetail: (id: number) => Promise<BibleVersion | null> = getVersionById,
): Promise<BibleVersion> {
	const detail = await loadDetail(catalog.id);
	// A catalogue entry followed by a missing detail is an inconsistent upstream
	// response, not evidence that a requested verse or Bible does not exist.
	if (!detail) throw new BibleUnavailableError('Bible version details are unavailable');
	return mergeVersionDetails(catalog, detail);
}

/**
 * Whether a locale's allowlist admits this version.
 *
 * English admits everything its blocklist has not withheld, which is what
 * `versionIds: null` means and why this returns true for it rather than
 * consulting a list it does not have.
 */
function carries(locale: Locale, version: Pick<BibleVersion, 'id'>): boolean {
	return locale.versionIds === null || locale.versionIds.includes(version.id);
}

/**
 * The version a locale reads in when the URL does not name one.
 *
 * English still reads `DEFAULT_BIBLE_ID` from the environment, which predates
 * the locale registry and stays because it is how a deploy repoints English
 * without a commit. Translated locales take the id from the registry instead:
 * their catalogue is a single version, so an env var per language would be
 * eight ways to break the only version that locale has.
 */
export async function getDefaultVersion(
	locale: Locale = DEFAULT_LOCALE,
): Promise<BibleVersion | null> {
	const preferredId = locale.prefix ? locale.defaultVersionId : DEFAULT_BIBLE_ID;
	const preferred = await getVersionById(preferredId);
	if (preferred) {
		return preferred;
	}

	const catalog = await listVersions(locale);
	return catalog[0] ? hydrateVersion(catalog[0]) : null;
}

/**
 * The index as this site uses it, which is a fraction of what the API sends.
 *
 * The full response is every verse of every chapter carrying an id, a passage
 * id and a title — 1,592,981 bytes for the NIV, and the passage id and title are
 * read by nothing here. That mattered far more than it sounds: `loadCached`
 * declines to write anything over 1.5 MB to the Runtime Cache, so the index was
 * the one key on the site that never had a regional entry and never had a stale
 * fallback. It lived in one instance's memory, which meant every cold start
 * spent a 1.6 MB upstream call to rebuild it, and an open breaker 503'd the home
 * page and every reader page while passage-only pages carried on from cache.
 *
 * Narrowed to what is actually read, the same index is 194,751 bytes and caches
 * like everything else. Narrowing on load rather than on read is deliberate
 * here — unlike the version catalogue, whose filters have to run on read because
 * the entry outlives the deploy that would change them, these fields are read by
 * nobody and no future filter can want them back without a code change anyway.
 */
export type IndexedChapter = {
	id: string;
	title: string;
	/** Verse ids only: the sole question asked of them is whether one exists. */
	verses: readonly string[];
};

export type IndexedBook = {
	id: string;
	title: string;
	full_title: string;
	abbreviation: string;
	canon: BibleIndexBook['canon'];
	chapters: readonly IndexedChapter[];
};

export type IndexedBible = {
	books: readonly IndexedBook[];
};

function narrowIndex(index: BibleIndex): IndexedBible {
	return {
		books: index.books.map((book) => ({
			id: book.id,
			title: book.title,
			full_title: book.full_title,
			abbreviation: book.abbreviation,
			canon: book.canon,
			chapters: book.chapters.map((chapter) => ({
				id: chapter.id,
				title: chapter.title,
				verses: chapter.verses.map((verse) => verse.id),
			})),
		})),
	};
}

/**
 * `v2` because the shape changed and the old one is still out there.
 *
 * The Runtime Cache survives deploys, and while the NIV's index was too large
 * to ever be written, a New Testament-only version's fits comfortably — so real
 * entries in the previous shape exist and would be served to code that now
 * expects verse ids to be strings. A new key retires them instead of trusting
 * that none were written.
 */
export function chapterIndexKey(versionId: number): string {
	return `index:v2:${versionId}`;
}

export async function getBibleIndex(versionId: number): Promise<IndexedBible> {
	return loadCached(chapterIndexKey(versionId), INDEX_CACHE_MS, STALE_GRACE_MS, async () =>
		narrowIndex(await withPlatform(() => getBibleClient().getIndex(versionId))),
	);
}

/**
 * Where "start reading" goes, without spending a call to find out.
 *
 * The home page used to answer this by fetching the whole index and reading
 * `books[0]` — a 1.6 MB upstream call, on the most linked URL on the site, to
 * discover that the Bible begins at Genesis 1. Worse, it was the only upstream
 * call the page could not survive losing: no index meant no `startHref`, which
 * meant a 503 in place of the entire page.
 *
 * So it asks the cache and accepts the answer either way. Genesis 1 is right for
 * every whole-Bible version, which is every version this site currently serves;
 * the peek is what keeps it right for the New Testament-only editions in the
 * locale registry, whose index says Matthew, on any instance that already holds
 * one. A link is not worth a fetch, and it is certainly not worth the page.
 */
export async function startReadingChapter(
	versionId: number,
): Promise<{ bookId: string; chapterId: string }> {
	const index = await peekCached<IndexedBible>(chapterIndexKey(versionId));
	const book = index?.books[0];
	const chapter = book?.chapters.find((entry) => isNumericChapter(entry.id));

	return book && chapter
		? { bookId: book.id, chapterId: chapter.id }
		: { bookId: 'GEN', chapterId: '1' };
}

export function findBook(index: IndexedBible, usfm: string) {
	const id = usfm.toUpperCase();
	return index.books.find((book) => book.id === id) ?? null;
}

export function findChapter<T extends { id: string }>(
	book: { chapters?: ReadonlyArray<T> },
	chapterId: string,
): T | null {
	return book.chapters?.find((chapter) => chapter.id === chapterId) ?? null;
}

export function adjacentReadableChapter(
	index: IndexedBible,
	bookId: string,
	chapterId: string,
	direction: 'next' | 'previous',
): { bookId: string; chapterId: string } | null {
	let current = { bookId, chapterId };

	for (let i = 0; i < 30; i += 1) {
		const next = getAdjacentChapter(
			index.books as unknown as BibleBook[],
			current.bookId,
			current.chapterId,
			direction,
		);
		if (!next) {
			return null;
		}
		if (isNumericChapter(next.chapterId) && !isIntroChapter(next.chapterId)) {
			return next;
		}
		current = next;
	}

	return null;
}

export async function getPassageHtml(
	versionId: number,
	usfm: string,
	options: { headings?: boolean; notes?: boolean } = {},
): Promise<BiblePassage | null> {
	const headings = options.headings ?? true;
	const notes = options.notes ?? true;
	const key = `passage:html:${versionId}:${usfm}:${headings ? 1 : 0}:${notes ? 1 : 0}`;

	return loadCached(key, PASSAGE_CACHE_MS, STALE_GRACE_MS, async () => {
		try {
			const passage = await withPlatform(() =>
				getBibleClient().getPassage(versionId, usfm, 'html', headings, notes, false),
			);

			if (!passage.content) {
				return null;
			}

			return {
				...passage,
				content: sanitizePassageHtml(passage.content),
			};
		} catch (error) {
			if (error instanceof BibleNotFoundError) {
				return null;
			}
			throw error;
		}
	});
}

/**
 * A single verse, taken from the chapter's cache entry rather than fetched.
 *
 * The upstream will serve `PSA.23.1` directly, and doing that gave every verse
 * page its own cache key: six versions times 31,103 verses is 186,618 keys that
 * no sitemap submits and no warmer can fill, so a crawler walking the verse hubs
 * met a cold key — and a metered fetch — on essentially every request. That is
 * what turned the 2026-08-20 audit crawl into 1,553 URLs 503'ing in six hours.
 *
 * The same text is already inside the chapter, which is 1,189 keys per version,
 * is what `pages/api/warm.ts` fills, and is what the reader page for that
 * chapter reads. So a verse page now shares the chapter's entry: cold, it spends
 * one fetch that ~26 sibling verse pages and the chapter page all then read;
 * warm, it spends none.
 *
 * `headings: true, notes: true` is not a preference — those are the options the
 * chapter reader page and the warmer use, and the cache key is built from them
 * (see `getPassageHtml`). Anything else here would create a second entry for the
 * same chapter that nothing else reads, which is the drift this is meant to end.
 *
 * Falls back to fetching the verse when the slice cannot be trusted — a
 * translation that merges two verses has no marker for the second — so this can
 * only ever cost fewer calls, never a different answer. See lib/bible/verses.ts.
 */
export async function getVerseHtml(
	versionId: number,
	bookUsfm: string,
	chapterId: string,
	verseId: string,
): Promise<BiblePassage | null> {
	const usfm = verseUsfm(bookUsfm, chapterId, verseId);

	const chapter = await getPassageHtml(versionId, chapterUsfm(bookUsfm, chapterId), {
		headings: true,
		notes: true,
	});

	if (chapter?.content) {
		const content = sliceVerse(chapter.content, verseId);
		if (content) {
			return {
				...chapter,
				id: usfm,
				content,
				// "Psalms 23" is what the chapter reports; the verse is what we asked
				// for. Matches the reference the upstream returns for it directly.
				reference: `${chapter.reference}:${verseId}`,
			};
		}

		// Past the end of the chapter, which the chapter itself just told us. The
		// fallback is for a verse the markup merged away, not for one that was
		// never there — and a crawler following next-verse links generates one of
		// these for every chapter in the Bible.
		const last = lastVerseId(chapter.content);
		if (last && Number(verseId) > Number(last)) {
			return null;
		}
	}

	return getPassageHtml(versionId, usfm, { headings: false, notes: true });
}

export async function getPassageText(
	versionId: number,
	usfm: string,
): Promise<BiblePassage | null> {
	return loadCached(
		`passage:text:${versionId}:${usfm}`,
		PASSAGE_CACHE_MS,
		STALE_GRACE_MS,
		async () => {
			try {
				const passage = await withPlatform(() =>
					getBibleClient().getPassage(versionId, usfm, 'text', false, false, false),
				);
				return passage.content ? passage : null;
			} catch (error) {
				if (error instanceof BibleNotFoundError) {
					return null;
				}
				throw error;
			}
		},
	);
}

/**
 * Today's verse.
 *
 * Keyed by day-of-year, which makes each entry immutable — today's verse never
 * changes — and rolls over to a fresh key at midnight UTC on its own. Caching
 * this matters more than the key count suggests: it is the home page's only
 * upstream dependency that is not shared with another route, so while it was
 * uncached a single throttled call took down `/` no matter how warm the rest of
 * the cache was.
 */
export async function getVerseOfTheDay(): Promise<VOTD | null> {
	const now = new Date();
	const start = Date.UTC(now.getUTCFullYear(), 0, 0);
	const day = Math.floor((Date.now() - start) / 86_400_000);

	return loadCached(`votd:day:${day}`, PASSAGE_CACHE_MS, STALE_GRACE_MS, async () => {
		try {
			return await withPlatform(() => getBibleClient().getVOTD(day));
		} catch (error) {
			if (error instanceof BibleNotFoundError) {
				return null;
			}
			throw error;
		}
	});
}

/**
 * The whole-year Verse of the Day calendar.
 *
 * 366 references curated by YouVersion — the best available "verses people
 * actually look up" list, and the seed set for which verse hubs get indexed
 * first. Cached for a day; the calendar is effectively static.
 */
export async function getVerseOfTheDayCalendar(): Promise<VOTD[]> {
	try {
		return await loadCached('votd:calendar', PASSAGE_CACHE_MS, STALE_GRACE_MS, async () => {
			const page = await withPlatform(() => getBibleClient().getAllVOTDs());
			return [...page.data];
		});
	} catch {
		// A missing calendar must not break the sitemap; topic verses still
		// provide a usable seed set on their own.
		//
		// The fallback sits outside `loadCached` on purpose. Returned from inside
		// the loader it would be cached as if it were a real answer, and one
		// throttled read would then hold an empty calendar — and a sitemap missing
		// its 366 seed hubs — for a full day.
		return [];
	}
}

export function chapterExists(
	book: { chapters?: ReadonlyArray<{ id: string }> },
	chapterId: string,
): boolean {
	if (!isNumericChapter(chapterId)) {
		return false;
	}
	return Boolean(findChapter(book, chapterId));
}

export function errorStatus(error: unknown): number {
	if (error instanceof BibleNotFoundError) {
		return 404;
	}
	if (error instanceof PlatformConfigError || error instanceof BibleUnavailableError) {
		return 503;
	}
	return 500;
}

export function verseExists(
	book: {
		chapters?: ReadonlyArray<{ id: string; verses: readonly string[] }>;
	},
	chapterId: string,
	verseId: string,
): boolean {
	if (!isNumericVerse(verseId)) {
		return false;
	}
	const chapter = findChapter(book, chapterId);
	return Boolean(chapter?.verses.includes(verseId));
}

export { PlatformConfigError };
