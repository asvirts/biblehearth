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
import { sanitizePassageHtml } from '../bible/sanitize';
import { isTripped, trip } from '../cache/breaker';
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
		return await operation();
	} catch (error) {
		if (getHttpStatus(error) === 429) {
			trip();
		}
		rethrowPlatformError(error);
	}
}

async function listAllEnglishVersions(): Promise<BibleVersion[]> {
	return loadCached(
		'versions:en',
		VERSION_CACHE_MS,
		STALE_GRACE_MS,
		async () =>
			withPlatform(async () => {
				const client = getBibleClient();
				const versions: BibleVersion[] = [];
				let pageToken: string | undefined;

				do {
					const page: Collection<BibleVersion> = await client.getVersions(
						'en*',
						undefined,
						{
							page_size: 99,
							page_token: pageToken,
						},
					);
					versions.push(...page.data);
					pageToken = page.next_page_token ?? undefined;
				} while (pageToken && versions.length < 2000);

				return versions;
			}),
	);
}

/**
 * The catalog as the site presents it.
 *
 * Exclusions are applied on read, not before caching: the Runtime Cache
 * survives deployments, so filtering at write time would leave a newly
 * excluded version live until the entry happened to expire.
 */
export async function listEnglishVersions(): Promise<BibleVersion[]> {
	const versions = await listAllEnglishVersions();
	return versions.filter((version) => !isExcludedVersion(version));
}

/**
 * The abbreviation to show users and to build slugs from.
 *
 * `abbreviation` carries YouVersion's internal edition suffix — NIV11,
 * engWEBUS, enggnv — but people search "john 3 niv", not "john 3 niv11".
 * `localized_abbreviation` is already the clean public form (NIV, WEBUS, GNV)
 * and correctly keeps genuinely distinct editions apart (NASB1995 vs NASB2020),
 * so it is preferred wherever the abbreviation is user-visible.
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

export async function resolveVersion(
	slug: string,
): Promise<{ version: BibleVersion; slug: string } | null> {
	const withId = slug.match(SLUG_WITH_ID);
	if (withId) {
		const id = Number(withId[2]);
		const version = await getVersionById(id);
		// An excluded version must 404 here too, or `/bible/tpt-1849` would
		// bypass the catalog filter entirely.
		if (!version || isExcludedVersion(version)) {
			return null;
		}
		const catalog = await listEnglishVersions().catch(() => [version]);
		return { version, slug: versionSlug(version, catalog) };
	}

	const catalog = await listEnglishVersions();
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

export async function getDefaultVersion(): Promise<BibleVersion | null> {
	const preferred = await getVersionById(DEFAULT_BIBLE_ID);
	if (preferred) {
		return preferred;
	}

	const catalog = await listEnglishVersions();
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
