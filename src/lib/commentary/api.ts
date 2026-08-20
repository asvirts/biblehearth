import { decodeEntities, truncateWords } from '../bible/text';
import { loadCached } from '../cache/store';
import { commentaryParagraphs, commentaryPlainText } from './text';
import {
	COMMENTARY_SOURCES,
	commentarySource,
	type CommentarySource,
	type CommentarySourceId,
} from './sources';

/**
 * Reader for the Free Use Bible API's commentary endpoints.
 *
 * Every author here died between 1714 and 1901, and Tyndale's notes were
 * released as a fixed corpus, so this text will not change again. That makes the
 * cache unusually cheap: a month of freshness with three months of grace, which
 * means a chapter is fetched roughly once per deploy cycle and an upstream
 * outage is invisible to readers.
 *
 * Nothing here is fatal. A missing commentary is the normal case — Matthew Henry
 * never covered Song of Songs, Tyndale's notes skip Judges — so a gap returns
 * null and the page renders the sources that do exist. A study page that 500s
 * because a 300-year-old author skipped a book would be an absurd failure mode.
 */

const API_ORIGIN = 'https://bible.helloao.org';

/** Immutable text: refresh monthly, stay usable for a quarter. */
const COMMENTARY_CACHE_MS = 30 * 24 * 60 * 60 * 1000;
const STALE_GRACE_MS = 90 * 24 * 60 * 60 * 1000;

/** The upstream is fast; a slow response means something is wrong. */
const REQUEST_TIMEOUT_MS = 6000;

export type CommentaryNote = {
	/** First verse the note covers. Notes often span a range. */
	verse: number;
	/** Safe HTML, one string per paragraph, scripture references linked. */
	paragraphs: string[];
};

export type ChapterCommentary = {
	source: CommentarySource;
	/** The chapter-level overview, where the source wrote one. */
	introduction: string[] | null;
	notes: CommentaryNote[];
};

export type BookOverview = {
	source: CommentarySource;
	/** The source's introduction to the whole book, as paragraphs of HTML. */
	introduction: string[];
};

type ApiVerseItem = {
	type?: string;
	number?: number;
	content?: unknown[];
};

type ApiChapterResponse = {
	book?: { introduction?: string | null };
	chapter?: {
		number?: number;
		introduction?: string | null;
		content?: ApiVerseItem[];
	};
};

async function fetchJson(path: string): Promise<unknown | null> {
	const response = await fetch(`${API_ORIGIN}${path}`, {
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		headers: { Accept: 'application/json' },
	});

	// 404 is the documented answer for "this author skipped this book", which is
	// data, not an error.
	if (response.status === 404) {
		return null;
	}
	if (!response.ok) {
		throw new Error(`Commentary upstream returned ${response.status}`);
	}
	return response.json();
}

/** Only strings carry text; anything else in the array is upstream noise. */
function textOf(content: unknown[] | undefined): string[] {
	return (content ?? []).filter(
		(item): item is string => typeof item === 'string',
	);
}

/**
 * The first psalm where the upstream's Jamieson-Fausset-Brown text stops
 * matching the chapter it is filed under.
 *
 * JFB's Psalms commentary closes each chapter introduction with its own scope
 * marker — "(Psa 23:1-6)" — which makes the misalignment self-evident and not a
 * matter of opinion: `/api/c/jamieson-fausset-brown/PSA/91.json` returns an
 * introduction ending "(Psa 92:1-15)". The drift starts at 73, where the notes
 * are already Psalm 74's, and widens with the chapter number — by 144 the
 * response carries Psalm 150. Psalms 1-72 are correctly aligned, and every
 * other book is unaffected.
 *
 * Suppressing beats remapping. Only 89 of the 150 psalms expose a marker, so a
 * lookup table would rest on inference for the other 61, and quietly serving
 * one wrong chapter of commentary is worse than serving two right ones: the
 * reader has no way to tell. Returning null puts this on the path the module
 * already treats as ordinary — Matthew Henry never covered Song of Songs
 * either — so the page renders Tyndale and Henry and says nothing about a
 * source it does not have.
 *
 * Revisit when the upstream fixes its Psalms index; nothing here needs to
 * change except this constant going away.
 */
const JFB_PSALMS_MISALIGNED_FROM = 73;

function isMisalignedUpstream(
	sourceId: CommentarySourceId,
	book: string,
	chapter: string | number,
): boolean {
	if (sourceId !== 'jamieson-fausset-brown' || book !== 'PSA') {
		return false;
	}
	const number = Number(chapter);
	return Number.isFinite(number) && number >= JFB_PSALMS_MISALIGNED_FROM;
}

/**
 * One chapter of one commentary, or null where the source has no note on it.
 *
 * `book` is a USFM id. All three sources answer to USFM directly — Tyndale also
 * publishes lowercase aliases (`Ezek`, `Phil`) but they are exact duplicates of
 * the USFM forms, so there is nothing to map.
 */
export async function loadChapterCommentary(
	sourceId: CommentarySourceId,
	book: string,
	chapter: string | number,
): Promise<ChapterCommentary | null> {
	const source = commentarySource(sourceId);
	if (!source) {
		return null;
	}

	if (isMisalignedUpstream(sourceId, book, chapter)) {
		return null;
	}

	return loadCached(
		`commentary:${sourceId}:${book}.${chapter}`,
		COMMENTARY_CACHE_MS,
		STALE_GRACE_MS,
		async () => {
			const payload = (await fetchJson(
				`/api/c/${sourceId}/${book}/${chapter}.json`,
			)) as ApiChapterResponse | null;

			const chapterData = payload?.chapter;
			if (!chapterData) {
				return null;
			}

			const notes = (chapterData.content ?? [])
				.filter((item) => item.type === 'verse')
				.map((item) => ({
					verse: Number(item.number) || 0,
					paragraphs: commentaryParagraphs(textOf(item.content)),
				}))
				.filter((note) => note.paragraphs.length > 0);

			const introduction = chapterData.introduction
				? commentaryParagraphs([chapterData.introduction])
				: null;

			// An entry with neither an introduction nor a note is an empty shell.
			if (!introduction && notes.length === 0) {
				return null;
			}

			return { source, introduction, notes } satisfies ChapterCommentary;
		},
		[`commentary:${sourceId}`],
	);
}

/**
 * Every source's take on one chapter, in reading-level order.
 *
 * Requests run together because they are independent and a study page waiting
 * on three sequential round trips is a page nobody scrolls. A source that fails
 * drops out rather than taking the page with it.
 */
export async function loadChapterCommentaries(
	book: string,
	chapter: string | number,
): Promise<ChapterCommentary[]> {
	const loaded = await Promise.all(
		COMMENTARY_SOURCES.map((source) =>
			loadChapterCommentary(source.id, book, chapter).catch(() => null),
		),
	);
	return loaded.filter((item): item is ChapterCommentary => item !== null);
}

/**
 * Each source's introduction to a whole book.
 *
 * Read from the book's first chapter rather than the books index: the chapter
 * payload already carries `book.introduction`, so this reuses a response the
 * chapter pages have very likely cached already instead of paying for a second
 * endpoint.
 */
export async function loadBookOverviews(book: string): Promise<BookOverview[]> {
	const loaded = await Promise.all(
		COMMENTARY_SOURCES.map(async (source) => {
			const introduction = await loadCached(
				`commentary-intro:${source.id}:${book}`,
				COMMENTARY_CACHE_MS,
				STALE_GRACE_MS,
				async () => {
					const payload = (await fetchJson(
						`/api/c/${source.id}/${book}/1.json`,
					)) as ApiChapterResponse | null;
					const raw = payload?.book?.introduction;
					return raw ? commentaryParagraphs([raw]) : null;
				},
				[`commentary:${source.id}`],
			).catch(() => null);

			return introduction?.length ? { source, introduction } : null;
		}),
	);
	return loaded.filter((item): item is BookOverview => item !== null);
}

/**
 * A one-line, plain-text gist of what the commentaries say about a chapter.
 *
 * Used only as a meta-description fallback on chapters that have no editorial
 * brief yet. Deliberately drawn from an introduction rather than a verse note,
 * because an introduction is written about the chapter as a whole and so reads
 * sensibly out of context, which is exactly what a search snippet needs.
 */
export function commentaryGist(
	commentaries: readonly ChapterCommentary[],
	limit = 240,
): string {
	for (const entry of commentaries) {
		if (!entry.introduction?.length) {
			continue;
		}
		// Strip the anchors, then decode. Both steps are required and in this
		// order: the paragraphs are HTML, so the tags have to go first, and the
		// text inside them was escaped on the way in — leaving it escaped would
		// put a literal `&#39;` in front of every apostrophe once Astro escaped
		// the attribute a second time.
		const text = decodeEntities(
			commentaryPlainText(entry.introduction).replace(/<[^>]+>/g, ''),
		).replace(/\s+/g, ' ').trim();

		// Too short to be a description; try the next source's introduction.
		if (text.length > 60) {
			return truncateWords(text, limit);
		}
	}
	return '';
}
