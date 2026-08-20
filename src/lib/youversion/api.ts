import {
	getAdjacentChapter,
	getHttpStatus,
	type BibleBook,
	type BibleIndex,
	type BiblePassage,
	type BibleVersion,
	type Collection,
	type VOTD,
} from '@youversion/platform-core';
import { DEFAULT_BIBLE_ID } from 'astro:env/server';
import {
	isIntroChapter,
	isNumericChapter,
	isNumericVerse,
} from '../bible/usfm';
import { isExcludedVersion } from '../bible/catalog';
import { DEFAULT_LOCALE, type Locale } from '../i18n/locales';
import { sanitizePassageHtml } from '../bible/sanitize';
import { isTripped, trip } from '../cache/breaker';
import { limitUpstream, UpstreamBusyError } from '../cache/limiter';
import { loadCached } from '../cache/store';
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
	return loadCached(
		`versions:${locale.code}`,
		VERSION_CACHE_MS,
		STALE_GRACE_MS,
		async () =>
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
export async function listVersions(
	locale: Locale = DEFAULT_LOCALE,
): Promise<BibleVersion[]> {
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
export function displayAbbreviation(
	version: Pick<BibleVersion, 'abbreviation' | 'localized_abbreviation'>,
): string {
	return version.localized_abbreviation || version.abbreviation;
}

export function versionSlug(
	version: Pick<BibleVersion, 'id' | 'abbreviation' | 'localized_abbreviation'>,
	catalog: ReadonlyArray<Pick<BibleVersion, 'id' | 'abbreviation' | 'localized_abbreviation'>>,
): string {
	const abbr = displayAbbreviation(version).toLowerCase();
	const collisions = catalog.filter(
		(item) => displayAbbreviation(item).toLowerCase() === abbr,
	);
	return collisions.length > 1 ? `${abbr}-${version.id}` : abbr;
}

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
	slug: string,
	locale: Locale = DEFAULT_LOCALE,
): Promise<{ version: BibleVersion; slug: string } | null> {
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
		return { version, slug: versionSlug(version, catalog) };
	}

	const catalog = await listVersions(locale);
	const matches = catalog.filter(
		(item) =>
			item.abbreviation.toLowerCase() === slug ||
			item.localized_abbreviation.toLowerCase() === slug,
	);

	if (matches.length === 1 && matches[0]) {
		return { version: matches[0], slug: versionSlug(matches[0], catalog) };
	}

	return null;
}

export async function getVersionById(id: number): Promise<BibleVersion | null> {
	return loadCached(
		`version:${id}`,
		VERSION_CACHE_MS,
		STALE_GRACE_MS,
		async () => {
			try {
				return await withPlatform(() => getBibleClient().getVersion(id));
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
	return catalog[0] ?? null;
}

export async function getBibleIndex(versionId: number): Promise<BibleIndex> {
	return loadCached(
		`index:${versionId}`,
		INDEX_CACHE_MS,
		STALE_GRACE_MS,
		async () => withPlatform(() => getBibleClient().getIndex(versionId)),
	);
}

export function findBook(index: BibleIndex, usfm: string) {
	const id = usfm.toUpperCase();
	return index.books.find((book) => book.id === id) ?? null;
}

export function findChapter<T extends { id: string }>(
	book: { chapters?: ReadonlyArray<T> },
	chapterId: string,
): T | null {
	return book.chapters?.find((chapter) => chapter.id === chapterId) ?? null;
}

export function readableChapters(
	book: { chapters?: ReadonlyArray<{ id: string; title: string }> },
) {
	return (book.chapters ?? []).filter((chapter) => isNumericChapter(chapter.id));
}

export function adjacentReadableChapter(
	index: BibleIndex,
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
				getBibleClient().getPassage(
					versionId,
					usfm,
					'html',
					headings,
					notes,
					false,
				),
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
					getBibleClient().getPassage(
						versionId,
						usfm,
						'text',
						false,
						false,
						false,
					),
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

	return loadCached(
		`votd:day:${day}`,
		PASSAGE_CACHE_MS,
		STALE_GRACE_MS,
		async () => {
			try {
				return await withPlatform(() => getBibleClient().getVOTD(day));
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
 * The whole-year Verse of the Day calendar.
 *
 * 366 references curated by YouVersion — the best available "verses people
 * actually look up" list, and the seed set for which verse hubs get indexed
 * first. Cached for a day; the calendar is effectively static.
 */
export async function getVerseOfTheDayCalendar(): Promise<VOTD[]> {
	try {
		return await loadCached(
			'votd:calendar',
			PASSAGE_CACHE_MS,
			STALE_GRACE_MS,
			async () => {
				const page = await withPlatform(() => getBibleClient().getAllVOTDs());
				return [...page.data];
			},
		);
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
		chapters?: ReadonlyArray<{
			id: string;
			verses: ReadonlyArray<{ id: string }>;
		}>;
	},
	chapterId: string,
	verseId: string,
): boolean {
	if (!isNumericVerse(verseId)) {
		return false;
	}
	const chapter = findChapter(book, chapterId);
	return Boolean(chapter?.verses.some((verse) => verse.id === verseId));
}

export { PlatformConfigError };
