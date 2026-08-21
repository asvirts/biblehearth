/**
 * What each version in the catalogue actually is, in our own words.
 *
 * `/bible/<slug>` used to be a heading and the sentence "Choose a book to start
 * reading." That made it the one page type on the site with no original writing
 * on it at all — and the head query for a translation ("what is the NIV", "NASB
 * reading level", "is the Amplified accurate") is the query a page like this
 * should own outright, against far weaker competition than any chapter faces.
 * Six pages, no passage fetch, and the same rule that governs a chapter brief:
 * the writing is what earns the indexation.
 *
 * Keyed by slug rather than by numeric id, because the slug is what the URL
 * carries and what a reader sees. A version with no record here still renders —
 * the page falls back to the book list alone — so the catalogue changing does
 * not break anything, it just leaves a page thin until someone writes it.
 *
 * Written to be read by someone who has never thought about translation before
 * and is trying to work out which Bible to use. That means every entry names
 * the honest downside: a page that only recommends is a page nobody can make a
 * decision from, and every one of these translations has readers it does not
 * suit.
 */

export type EditionComparison = {
	/** Another version in this catalogue, so the link stays internal. */
	slug: string;
	/** How it is labelled in prose. */
	label: string;
	/** Why someone reading about this version would want that one. */
	note: string;
};

export type BibleEdition = {
	/** Matches `versionSlug()`, which is how the URL and this record meet. */
	slug: string;
	/**
	 * What to call this translation, where the publisher's own title will not do.
	 *
	 * `localized_title` is usually right, but the two NASB editions arrive as
	 * "New American Standard Bible - NASB 1995" and "New American Standard Bible
	 * - NASB", which already carry an abbreviation and disagree with the one in
	 * the slug — the 2020 edition is titled "NASB" while its abbreviation is
	 * NASB2020. Naming the page is an editorial act either way, so the override
	 * belongs here rather than in a rule that rewrites publisher titles.
	 */
	name?: string;
	/** Short label for prose, where the catalogue's abbreviation reads badly. */
	abbr?: string;
	/** Who made it and when. Rendered as the kicker under the heading. */
	byline: string;
	/**
	 * One or two sentences that work as the lede and as the meta description.
	 * Says what the translation is for and what it costs, in that order.
	 */
	summary: string;
	/** Where it came from and why it exists. One paragraph each. */
	about: readonly string[];
	/** The translation philosophy, without the jargon for it. */
	approach: string;
	/** Plainly stated, because it is what a lot of people are really asking. */
	readingLevel: string;
	/**
	 * The same fact as `readingLevel`, short enough for a table cell.
	 *
	 * A separate field rather than a truncation of the one above, because the
	 * sentence above is written to be read and this is written to be scanned
	 * against five others. Truncating "About a seventh-grade reading level." to
	 * fit a column yields "About a seventh-grade…", which is worse than either.
	 *
	 * Not every translation has one. The Amplified's difficulty is not a grade
	 * level — its sentences are crowded rather than advanced — and saying "11th
	 * grade" about it would be inventing a number to fill a cell.
	 */
	readingGrade: string;
	/** Who should reach for this one. */
	bestFor: string;
	/** The honest limitation. Never omitted, never softened into a compliment. */
	caution: string;
	/** The nearest neighbours in the catalogue, for readers still deciding. */
	compare: readonly EditionComparison[];
};

export const BIBLE_EDITIONS: readonly BibleEdition[] = [
	{
		slug: 'niv',
		byline: 'Committee on Bible Translation, 1978 — revised 1984 and 2011',
		summary:
			'The most widely read modern English Bible. It aims for the sentence an English writer would have written, which makes it easy to read and sometimes hides how strange the original wording is.',
		about: [
			'The NIV was translated from scratch in the 1960s and 70s by scholars from several countries and denominations. The committee wanted a Bible that no single church tradition owned. It has been revised twice, in 1984 and 2011, and the committee still meets to review the translation.',
			'It sits in the middle of the range translators argue about. A word-for-word translation follows the grammar of the Hebrew or Greek even when the English comes out strange; a thought-for-thought translation says what the sentence means and lets the grammar go. The NIV does the first where it can and the second where it has to, which is why it reads smoothly and why people who want to see the seams reach for something else.',
			'The 2011 revision is the one you are reading here. Its most argued-over change was to say "brothers and sisters" where the Greek says "brothers" but is addressing a whole church, and to make similar changes elsewhere. Some readers welcomed that as more accurate to who was being spoken to; others preferred the older wording. Knowing the change exists is usually enough.',
		],
		approach:
			'Balanced — closer to the original wording than a paraphrase, freer than a strictly literal translation.',
		readingGrade: '7th grade',
		readingLevel: 'About a seventh-grade reading level.',
		bestFor:
			'Reading whole books at a time, reading out loud, and being the version most people around you already have.',
		caution:
			'Where the Hebrew or Greek could go two ways, the NIV usually picks one and reads well. You get a clear sentence, but nothing on the page tells you a choice was made. If a verse matters to you, read a more literal version beside it.',
		compare: [
			{
				slug: 'nirv',
				label: 'NIrV',
				note: 'The same translation, rewritten at about a third-grade reading level.',
			},
			{
				slug: 'nasb2020',
				label: 'NASB 2020',
				note: 'Much more literal, and much stiffer to read.',
			},
		],
	},
	{
		slug: 'amp',
		byline: 'The Lockman Foundation, 1965 — revised 2015',
		summary:
			'A Bible that opens a word up instead of choosing one English equivalent for it, using brackets to show the other meanings the original could carry.',
		about: [
			'Most translations choose one English rendering for a Hebrew or Greek word. The Amplified often places several options together, using brackets and parentheses to mark the extra help. Frances Siewert began the work, the complete Bible appeared in 1965, and a major revision followed in 2015.',
			'The effect is that a single verse can tell you what a translator would otherwise have to put in a footnote. If you have ever wondered why two Bibles word the same verse differently, the Amplified is often showing you both answers at once.',
		],
		approach:
			'Expanded — one verse, several possible renderings, with the additions marked.',
		readingGrade: 'No fixed level',
		readingLevel:
			'Hard to read at length — not because the vocabulary is difficult, but because the sentences are crowded.',
		bestFor:
			'Sitting with one verse or one paragraph and seeing what the words could mean.',
		caution:
			'Seeing every possible meaning of a word on one line can suggest it means all of them at once. It almost never does: in any given sentence the writer meant one thing, and the surrounding verses are what narrow it down. Treat the brackets as options to weigh, not as meanings to add together.',
		compare: [
			{
				slug: 'nasb1995',
				label: 'NASB 1995',
				note: 'From the same publisher, and the opposite method: one carefully chosen English word per original word.',
			},
		],
	},
	{
		slug: 'nasb1995',
		name: 'New American Standard Bible 1995',
		abbr: 'NASB 1995',
		byline: 'The Lockman Foundation, 1971 — updated 1995',
		summary:
			'One of the most literal English Bibles in common use, and the edition many readers deliberately stayed with when the 2020 revision arrived.',
		about: [
			'The NASB descends from the American Standard Version of 1901, and it inherited that translation’s habit of following the Hebrew and Greek closely even where the English comes out stiff. Where the original has an unusual word order or an odd idiom, you can usually see it through the English. The 1995 update smoothed the language a little without changing the method.',
			'The 1995 and 2020 editions are both included because they feel different on the page, and many longtime NASB readers have a clear preference between them.',
		],
		approach:
			'Formal — follows the grammar of the original closely, and lets the English be awkward when the original is.',
		readingGrade: '11th grade',
		readingLevel: 'Around an eleventh-grade reading level.',
		bestFor:
			'Studying how a sentence is built and checking a verse you first read in a smoother translation.',
		caution:
			'A literal rendering can still be hard to understand. When the NASB mirrors Greek word order, you may recognize every word and still need to untangle the sentence. Paul’s long sentences often remain long in English.',
		compare: [
			{
				slug: 'nasb2020',
				label: 'NASB 2020',
				note: 'The current revision, with more natural English and updated wording for passages addressed to mixed groups.',
			},
		],
	},
	{
		slug: 'nasb2020',
		name: 'New American Standard Bible 2020',
		abbr: 'NASB 2020',
		byline: 'The Lockman Foundation, 2020',
		summary:
			'The current New American Standard Bible keeps the 1995 edition’s literal method while smoothing English that had become needlessly stiff.',
		about: [
			'The 2020 revision stays close to the Hebrew and Greek while recognizing that some awkwardness in earlier editions came from dated English. Editors rebuilt sentences when the older wording made the meaning unnecessarily hard to follow.',
			'It also changed how the translation handles words that addressed a mixed group. Where the Greek says "brothers" but is speaking to a whole church, this edition says "brothers and sisters"; where "man" meant a person, it often says "person". That change is the main reason the 1995 edition is still widely read, and both are on this site so you can compare them verse by verse.',
		],
		approach:
			'Formal — the same close-to-the-original method as 1995, in more natural English.',
		readingGrade: '10th grade',
		readingLevel:
			'Around a tenth-grade reading level, a little easier than the 1995 edition.',
		bestFor: 'Wanting a literal translation without fighting the sentences.',
		caution:
			'If you memorised verses from an older NASB, some of them are worded differently here. That is a revision doing its job, but it is disconcerting the first time it happens.',
		compare: [
			{
				slug: 'nasb1995',
				label: 'NASB 1995',
				note: 'The previous edition, kept here because many readers prefer it.',
			},
		],
	},
	{
		slug: 'nirv',
		byline: 'Committee on Bible Translation, 1996 — revised 2014',
		summary:
			'The NIV rewritten in short sentences and everyday words, for children and for anyone reading English as a new language.',
		about: [
			'The NIrV starts from the NIV and simplifies it on purpose: shorter sentences, commoner words, one idea at a time. It was made for young readers and for people learning English, and it is the plainest Bible in this catalogue by a wide margin.',
			'Plain is not the same as childish. Adults who find most Bibles heavy going often get much further in this one, and there is no reason to feel odd about reading it.',
		],
		approach:
			'Simplified — the NIV’s meaning, restated in the shortest sentences that will carry it.',
		readingGrade: '3rd grade',
		readingLevel: 'Around a third-grade reading level.',
		bestFor:
			'Reading with children, reading in a second language, and getting through a whole book without stalling.',
		caution:
			'Breaking a long sentence into several short ones can make its connections harder to see. Paul often links each step with words such as "therefore," "because," and "so that." The NIrV keeps the steps, but the argument may feel more like a list. Compare a fuller translation when the logic of a passage matters.',
		compare: [
			{
				slug: 'niv',
				label: 'NIV',
				note: 'The translation this one simplifies.',
			},
		],
	},
	{
		slug: 'bsb',
		byline: 'Bible Hub and the Berean Bible translation team, 2022',
		summary:
			'A modern translation released under an unusually open license, which is why it appears in so many study tools and Bible apps.',
		about: [
			'The Berean Standard Bible was produced alongside the interlinear and study tools at Bible Hub, and it was built to be given away: the text is freely licensed, so anyone can quote it, print it or build on it without asking permission. Almost every other modern translation is tightly licensed, and that one difference explains how fast the BSB spread.',
			'The translation aims for a middle path. It stays close enough to the original wording for study and remains smooth enough for extended reading.',
		],
		approach:
			'Balanced — readable English, kept close to the wording underneath it.',
		readingGrade: '8th grade',
		readingLevel: 'Around an eighth-grade reading level.',
		bestFor:
			'Comparing wording, quoting freely, and using study tools that need a modern text with an open license.',
		caution:
			'It is new, and very few churches read from it. Nothing is wrong with the translation, but you will rarely be following along in it on a Sunday, and far less has been written about it than about older versions.',
		compare: [
			{
				slug: 'niv',
				label: 'NIV',
				note: 'A similar approach with far more history behind it and far tighter licensing.',
			},
		],
	},
];

/**
 * The one-word half of `approach`, for a comparison table.
 *
 * Every `approach` is written as "Label — the explanation", so the label is
 * already there and does not need writing twice. Deriving it means the table and
 * the prose can never disagree about which category a translation is in, which
 * is the failure a seventh hand-kept field would eventually produce.
 */
export function editionStyle(edition: BibleEdition): string {
	const [label] = edition.approach.split('—');
	return (label ?? edition.approach).trim();
}

const bySlug = new Map(BIBLE_EDITIONS.map((edition) => [edition.slug, edition]));

export function editionForSlug(slug: string): BibleEdition | null {
	return bySlug.get(slug) ?? null;
}
