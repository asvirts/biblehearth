/**
 * Plain-text extraction from sanitized passage HTML, for <title> and
 * <meta name="description">.
 *
 * `sanitizePassageHtml` escapes every text node, so a naive
 * `replace(/<[^>]+>/g, '')` leaves literal `&amp;` / `&#8217;` entities behind.
 * It also keeps editorial apparatus that is not scripture prose — section
 * headings, verse-number labels, and translator footnotes — which get welded
 * onto the text ("Jesus Teaches Nicodemus1Now there was a Pharisee...").
 */

/**
 * Elements whose entire subtree is editorial apparatus rather than scripture.
 * Matched as class tokens, so `yv-n f` and `s1 yv-h` both hit.
 *
 * - `yv-vlbl` visible verse-number label ("1", "2", ...)
 * - `yv-n`    translator footnote (nests `fr`/`ft`/`fq`/`fqa` spans)
 * - `yv-h`    section heading ("Jesus Teaches Nicodemus")
 */
const DROP_CLASSES = ['yv-vlbl', 'yv-n', 'yv-h'];

/** Tags that imply a whitespace boundary when removed. */
const BLOCK_TAGS = new Set([
	'div',
	'p',
	'br',
	'li',
	'tr',
	'td',
	'th',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'blockquote',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img']);

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
};

const TAG_PATTERN = /<(\/?)([a-z0-9]+)([^>]*)>/gi;

function hasDropClass(attrs: string): boolean {
	const match = /class\s*=\s*"([^"]*)"/i.exec(attrs);
	if (!match) {
		return false;
	}
	return match[1]
		.split(/\s+/)
		.some((token) => DROP_CLASSES.includes(token));
}

function fromCodePoint(code: number): string {
	if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
		return '';
	}
	try {
		return String.fromCodePoint(code);
	} catch {
		return '';
	}
}

export function decodeEntities(value: string): string {
	return value
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) => fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => fromCodePoint(Number(dec)))
		.replace(
			/&([a-z]+);/gi,
			(whole, name) => NAMED_ENTITIES[name.toLowerCase()] ?? whole,
		);
}

/**
 * Extract readable scripture prose from sanitized passage HTML.
 *
 * Drops section headings, verse-number labels, and footnotes along with their
 * subtrees, then unescapes entities and collapses whitespace.
 */
export function scriptureToPlainText(html: string): string {
	let out = '';
	let lastIndex = 0;
	// Depth inside a dropped subtree; 0 means we are emitting text.
	let dropDepth = 0;
	let dropTag = '';

	TAG_PATTERN.lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = TAG_PATTERN.exec(html)) !== null) {
		const [whole, closing, rawTag, attrs] = match;
		const tag = rawTag.toLowerCase();

		// Text preceding this tag belongs to the state we were already in.
		if (dropDepth === 0) {
			out += html.slice(lastIndex, match.index);
		}
		lastIndex = match.index + whole.length;

		const selfClosing = /\/\s*$/.test(attrs) || VOID_TAGS.has(tag);

		if (!closing) {
			if (dropDepth > 0) {
				// Track nesting so we close on the right tag.
				if (!selfClosing && tag === dropTag) {
					dropDepth += 1;
				}
			} else if (!selfClosing && hasDropClass(attrs)) {
				dropDepth = 1;
				dropTag = tag;
			}
		} else if (dropDepth > 0 && tag === dropTag) {
			dropDepth -= 1;
			if (dropDepth === 0) {
				// Removing an inline subtree would otherwise weld its
				// neighbours together ("born again.Jesus replied").
				out += ' ';
			}
		}

		if (dropDepth === 0 && BLOCK_TAGS.has(tag)) {
			out += ' ';
		}
	}

	if (dropDepth === 0) {
		out += html.slice(lastIndex);
	}

	return decodeEntities(out)
		.replace(/\s+/g, ' ')
		.replace(/\s+([,.;:!?’”）)\]])/g, '$1')
		.trim();
}

/**
 * Truncate without splitting a word. Falls back to a hard cut when the text has
 * no usable break near the limit (long unspaced scripts).
 */
export function truncateWords(text: string, max = 155): string {
	const collapsed = text.replace(/\s+/g, ' ').trim();
	if (collapsed.length <= max) {
		return collapsed;
	}

	const cut = collapsed.slice(0, max - 1);
	const lastSpace = cut.lastIndexOf(' ');
	const body = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
	return `${body.replace(/[\s,;:.—-]+$/, '')}…`;
}
