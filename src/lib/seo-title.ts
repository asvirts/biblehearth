/**
 * Punctuation a translator put there, which is the only clause boundary that
 * can be trusted without parsing the sentence.
 *
 * A conjunction would fit more verses — "For God so loved the world" ends at
 * its `that`, and that is the phrase people type. But the same rule applied
 * before `and` yields "he gave his one", and nothing short of a parse tells
 * those two apart. So the boundary stays where the punctuation is.
 *
 * Built per call rather than shared: a `/g` regex carries its own `lastIndex`,
 * and one at module scope is a cursor two callers can move under each other.
 */
const clauseBoundary = () => /[,;:.!?—]/g;

/**
 * How short a clause is allowed to be before it stops being worth saying.
 *
 * Longest-fitting is the wrong pick when the only boundary near the start is
 * after a connective: Matthew 5:16 opens "In the same way," — fifteen
 * characters and four words that describe no verse in particular, which is why
 * both floors are here rather than one. Below them the caller is better off
 * spending the budget on what the page is.
 */
const CLAUSE_MIN = 22;
const CLAUSE_MIN_WORDS = 4;

/**
 * Trailing punctuation and quote marks the cut orphaned, off.
 *
 * Cuts land inside quotations constantly — Psalm 46:10 is `He says, “Be still,
 * and know that I am God`, and Jeremiah 29:11 begins mid-quotation, so its
 * first clause ends `for you,”` with nothing that opened it. An unpaired mark
 * reads as a truncation artefact even though every word is whole, so an
 * unbalanced pair loses both marks rather than half of one.
 *
 * `’` is the exception and is never removed: it is also the apostrophe, so
 * deleting a surplus one turns "brother’s" into "brothers" — a corrupted word,
 * which is worse than a missing quote mark. A clause carrying both an
 * apostrophe and an orphaned `‘` therefore keeps the orphan. Rare, and erring
 * in that direction cannot damage the text.
 */
function tidyClause(text: string): string {
	let out = text.trim();
	const count = (mark: RegExp) => (out.match(mark) ?? []).length;

	if (count(/“/g) !== count(/”/g)) {
		out = out.replace(/[“”]/g, '');
	}
	if (count(/‘/g) > count(/’/g)) {
		out = out.replace(/‘/g, '');
	}

	// Punctuation last, because removing a quote can expose the comma behind
	// it: a clause ending `for you,”` is a dangling comma once the orphan is
	// gone. Not a shape found in 48k characters of quote-dense NIV, but the
	// order costs nothing and the alternative is silent.
	return out
		.replace(/[,;:—-]+$/, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

/**
 * The longest prefix of `text` that fits `max` and still ends a thought.
 *
 * Returns `''` when nothing qualifies, which is the caller's signal to say
 * less rather than to cut anyway. That distinction is the whole point: a
 * snippet chopped to fit produces "From the rising of the sun to the…", which
 * is not a phrase anyone searches and reads as broken text in a result. A
 * snippet chopped at a comma produces "The Spirit of the Sovereign Lord is on
 * me", which is both.
 */
export function clauseWithin(text: string, max: number): string {
	const clean = text.replace(/\s+/g, ' ').trim();
	if (!clean) {
		return '';
	}

	const whole = tidyClause(clean);
	if (whole.length <= max) {
		return whole;
	}

	let best = '';
	const boundary = clauseBoundary();
	let match: RegExpExecArray | null;
	while ((match = boundary.exec(clean))) {
		// A full stop belongs to the clause it ends; a comma does not.
		const end = match.index + (/[.!?]/.test(match[0]) ? 1 : 0);
		const piece = tidyClause(clean.slice(0, end));
		if (piece.length > max) {
			break;
		}
		if (
			piece.length >= CLAUSE_MIN &&
			piece.split(' ').length >= CLAUSE_MIN_WORDS
		) {
			best = piece;
		}
	}
	return best || wordsWithin(clean, max);
}

/**
 * A word-boundary prefix when the verse has no early punctuation.
 *
 * John 3:16 never hits a comma before Google's title budget is gone, so the
 * clause helper used to return nothing and the title fell back to
 * "John 3:16 in 6 Translations" — the same shape on every hub, with the
 * searched phrase sitting unused in the body. A run of whole words is still
 * a real prefix of the verse, not an ellipsis cut, which is why this only
 * runs after punctuation found nothing that fit.
 */
function wordsWithin(text: string, max: number): string {
	if (text.length <= max) {
		return tidyClause(text);
	}

	let best = '';
	for (const word of text.split(' ')) {
		const next = best ? `${best} ${word}` : word;
		if (next.length > max) {
			break;
		}
		best = next;
	}

	const piece = tidyClause(best);
	if (
		piece.length < CLAUSE_MIN ||
		piece.split(' ').length < CLAUSE_MIN_WORDS
	) {
		return '';
	}
	return piece;
}

/**
 * The character budget for a `<title>`.
 *
 * Bing Webmaster Tools reports anything longer as an error rather than a hint,
 * and Google truncates around the same point, so the ceiling is real on both
 * sides. Sixty-five is Bing's line; we aim under it rather than at it.
 */
export const TITLE_MAX = 65;

/**
 * A reference, as much of the verse as ends cleanly, and what the page is.
 *
 * `head` is the reference and carries the query. `tail` says what the page is
 * ("in 6 Translations"), and it describes every verse hub equally, so it is the
 * part worth spending last — it was winning by default before, costing eighteen
 * characters that left Psalm 23:1, a thirty-nine character verse, rendering as
 * bare "Psalm 23:1 in 6 Translations" with the other twenty-six unspent. The
 * clause is what only this page can say, and a reader searching a half-
 * remembered phrase matches on it.
 *
 * So the clause is measured against the reference alone and the tail is only
 * added when it costs the clause nothing. Sizing the clause to fit both instead
 * buys the tail with the better half of the verse: Joshua 1:9 becomes "Have I
 * not commanded you?" and drops "Be strong and courageous", which is the phrase
 * being searched. When no clause qualifies the result is exactly the old title,
 * so this can only add.
 */
export function titleWithClause(
	head: string,
	tail: string,
	snippet: string,
	max = TITLE_MAX,
): string {
	const withTail = `${head} ${tail}`;
	const clause = clauseWithin(snippet, max - head.length - 3);
	if (!clause) {
		return withTail;
	}
	const both = `${withTail} — ${clause}`;
	return both.length <= max ? both : `${head} — ${clause}`;
}
