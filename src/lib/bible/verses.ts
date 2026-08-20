/**
 * One verse, cut out of the chapter that already contains it.
 *
 * A verse page used to be its own upstream fetch, which made the crawlable
 * surface of this site roughly (verses x versions): 31,103 verses in six
 * versions is 186,618 URLs that no sitemap submits, every one of them a cold
 * cache key and a licensed passage fetch against a rate-limited app key. A
 * crawler walking the translation links on the verse hubs turns that into the
 * 429 storm of 2026-08-20 — 1,553 distinct URLs 503'ing in six hours — and no
 * warmer can stay ahead of a frontier that size.
 *
 * The chapter is the unit the upstream actually serves and the unit the warmer
 * fills, so it is the unit worth caching. There are 1,189 of them per version,
 * each holding ~26 verses, and slicing one out costs nothing: the passage HTML
 * marks every verse with `<span class="yv-v" v="N">`, and `sanitizePassageHtml`
 * keeps `v` on a span precisely so this stays possible. Same text, same markup,
 * one fetch instead of twenty-six.
 *
 * What it will not do is guess. If the chapter's markup is not the shape this
 * expects, or the verse has no marker of its own — a translation that merges two
 * verses into one has no `v="5"` to find — it returns null and the caller falls
 * back to fetching the verse directly. Returning approximately the right
 * Scripture would be far worse than spending the call.
 */

const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)(\/?)>/g;
const VOID_TAGS = new Set(['br', 'hr']);
const CLASS_ATTR = /\bclass="([^"]*)"/;
const VERSE_ATTR = /\bv="([^"]*)"/;

/** The class the platform marks a verse boundary with. */
const VERSE_MARKER_CLASS = 'yv-v';

type Block = {
	/** The block's own open tag, verbatim, so a slice can be rewrapped in it. */
	open: string;
	close: string;
	inner: string;
};

type Marker = {
	verse: string;
	/** Index into `blocks`. */
	block: number;
	/** Offset within that block's `inner` where the marker's own tag begins. */
	at: number;
};

/**
 * The chapter as blocks and verse boundaries, or null if it is not the shape
 * every version returns today.
 *
 * That shape is flat: one wrapping element, whose children are block elements
 * (`p`, `q1`, `li1`), with verse markers as direct children of those blocks and
 * nothing nested deeper. Verified across all six versions of the catalogue on
 * poetry, prose, words-of-Jesus and Psalm 119's 176 verses — markers sit at
 * depth two every time. Bailing on anything else is what makes the fallback
 * meaningful rather than decorative.
 */
function parseChapter(
	content: string,
): { blocks: Block[]; markers: Marker[] } | null {
	const blocks: Block[] = [];
	const markers: Marker[] = [];

	let depth = 0;
	let openTag = '';
	let innerStart = -1;
	let match: RegExpExecArray | null;

	TAG.lastIndex = 0;
	while ((match = TAG.exec(content))) {
		const [full, rawTag, attrs, selfClose] = match;
		const tag = (rawTag ?? '').toLowerCase();

		if (full.startsWith('</')) {
			depth -= 1;
			// Just closed a block: everything between its tags is its content.
			if (depth === 1 && innerStart !== -1) {
				blocks.push({
					open: openTag,
					close: full,
					inner: content.slice(innerStart, match.index),
				});
				innerStart = -1;
			}
			continue;
		}

		const isVoid = VOID_TAGS.has(tag) || selfClose === '/';

		if (
			tag === 'span' &&
			CLASS_ATTR.exec(attrs ?? '')?.[1]?.split(/\s+/).includes(VERSE_MARKER_CLASS)
		) {
			// Wrapper plus block. Anywhere else and the assumption above is wrong.
			if (depth !== 2 || innerStart === -1) {
				return null;
			}
			const verse = VERSE_ATTR.exec(attrs ?? '')?.[1];
			if (!verse) {
				return null;
			}
			markers.push({ verse, block: blocks.length, at: match.index - innerStart });
		}

		if (isVoid) {
			continue;
		}

		// depth 0 -> the wrapper; depth 1 -> a block whose content we want.
		if (depth === 1) {
			openTag = full;
			innerStart = match.index + full.length;
		}
		depth += 1;
	}

	if (depth !== 0 || markers.length === 0) {
		return null;
	}

	return { blocks, markers };
}

/** Whether a slice holds anything a reader would see. */
function hasText(html: string): boolean {
	return html.replace(TAG, '').trim().length > 0;
}

/**
 * The HTML for a single verse, in the same form the upstream returns for it.
 *
 * A verse runs from its own marker to the next one, which in poetry means it
 * carries on across several blocks — Isaiah 40:2 is six `q1`/`q2` lines. Each
 * piece is rewrapped in the block tag it came from, so the line breaks and
 * indentation the translation asked for survive the cut.
 */
export function sliceVerse(chapterHtml: string, verseId: string): string | null {
	const parsed = parseChapter(chapterHtml);
	if (!parsed) {
		return null;
	}

	const { blocks, markers } = parsed;
	const index = markers.findIndex((marker) => marker.verse === verseId);
	if (index === -1) {
		return null;
	}

	const start = markers[index];
	const next = markers[index + 1];
	if (!start) {
		return null;
	}

	const lastBlock = next ? next.block : blocks.length - 1;
	const pieces: string[] = [];

	for (let i = start.block; i <= lastBlock; i += 1) {
		const block = blocks[i];
		if (!block) {
			return null;
		}

		// The verse begins mid-block on its marker, and ends mid-block on the
		// next one; the blocks in between belong to it whole.
		const from = i === start.block ? start.at : 0;
		const to = next && i === next.block ? next.at : block.inner.length;
		const inner = block.inner.slice(from, to);

		if (hasText(inner)) {
			pieces.push(`${block.open}${inner}${block.close}`);
		}
	}

	if (pieces.length === 0) {
		return null;
	}

	// Wrapped, because that is what the upstream hands back for a single verse
	// and what `Passage` and the markdown twins are written against.
	return `<div>${pieces.join('')}</div>`;
}

/**
 * The last verse the chapter marks, so a caller can tell a verse that does not
 * exist from one it merely could not cut.
 *
 * Both come back from `sliceVerse` as null, and they deserve opposite
 * treatment: a merged verse is worth fetching on its own, while `Isaiah 41:30`
 * in a chapter that ends at 29 is worth nothing at all. Crawlers walk the
 * next-verse link off the end of every chapter, so answering that without a
 * request is the difference between one wasted fetch and thousands.
 */
export function lastVerseId(chapterHtml: string): string | null {
	const parsed = parseChapter(chapterHtml);
	return parsed?.markers.at(-1)?.verse ?? null;
}
