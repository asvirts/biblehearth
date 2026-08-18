/**
 * The commentaries this site republishes, in the order they render on a page.
 *
 * Order is a reading-level decision, not a scholarly one. Tyndale's notes are
 * modern English written to be read alongside the text; Matthew Henry is 1706
 * and Jamieson-Fausset-Brown is 1871, both with long sentences and vocabulary
 * that stops a new reader cold. Someone who meets Henry first concludes the
 * Bible is for other people, so the plainest voice goes first and every older
 * source carries a `readingNote` saying, in advance, what it is and how it
 * reads. Nobody should have to discover that a paragraph is three centuries old
 * by failing to understand it.
 *
 * Every licence below was checked against the publisher's own statement. The
 * upstream API advertises "no copyright restrictions whatsoever" across its
 * whole catalogue, which is simply wrong for Tyndale — so the per-resource
 * `licenseUrl` it also exposes is what we treat as authoritative, and what
 * these records mirror.
 */

export type CommentarySourceId =
	| 'tyndale'
	| 'matthew-henry'
	| 'jamieson-fausset-brown';

export type CommentaryLicense = {
	/** Shown to the reader verbatim. */
	name: string;
	/** Deep link to the licence text. Required for CC attribution. */
	url: string;
	/**
	 * Whose copyright it is. Null for public domain, where there is no holder
	 * and claiming one would be false.
	 */
	holder: string | null;
	/**
	 * True where the licence carries a share-alike term. Drives the notice that
	 * has to travel with the text, so it is a rendering input, not a comment.
	 */
	shareAlike: boolean;
};

export type CommentarySource = {
	id: CommentarySourceId;
	/** Full title, used in headings and attribution. */
	name: string;
	/** Compact label for tabs, jump links, and tight spaces. */
	shortName: string;
	/** Author and date, rendered under the heading. */
	byline: string;
	/** Author alone, for structured data where a date would be noise. */
	author: string;
	/**
	 * What this commentary is, in words a first-time reader can use to decide
	 * whether to read it. Not a blurb — an orientation.
	 */
	about: string;
	/**
	 * The honest warning about difficulty. Rendered for older sources only;
	 * null where the prose needs no apology.
	 */
	readingNote: string | null;
	license: CommentaryLicense;
	/** Where the work itself lives, for readers who want the original. */
	homepage: string;
};

const PUBLIC_DOMAIN: CommentaryLicense = {
	name: 'Public domain',
	url: 'https://creativecommons.org/publicdomain/mark/1.0/',
	holder: null,
	shareAlike: false,
};

export const COMMENTARY_SOURCES: readonly CommentarySource[] = [
	{
		id: 'tyndale',
		name: 'Tyndale Open Study Notes',
		shortName: 'Tyndale',
		byline: 'Tyndale House Publishers, released openly in 2023',
		author: 'Tyndale House Publishers',
		about:
			'Short, plain-English notes written for people reading the Bible for the first time. They explain what a word meant to its original audience, why a detail is there, and where else in Scripture the same idea shows up. If you only read one set of notes on this page, read this one.',
		readingNote: null,
		license: {
			name: 'CC BY-SA 4.0',
			url: 'https://creativecommons.org/licenses/by-sa/4.0/',
			holder: 'Tyndale House Publishers',
			shareAlike: true,
		},
		homepage: 'https://tyndaleopenresources.com/',
	},
	{
		id: 'matthew-henry',
		name: "Matthew Henry's Commentary on the Whole Bible",
		shortName: 'Matthew Henry',
		byline: 'Matthew Henry, 1706–1714',
		author: 'Matthew Henry',
		about:
			'A pastor writing for his own congregation three hundred years ago. Henry is less interested in historical background than in what a chapter asks of the person reading it, which is why he is still quoted in sermons today. He is warm, direct, and unafraid to apply a text to you.',
		readingNote:
			'Written in the early 1700s. The sentences are long and some words have shifted meaning since — "conversation" means how a person lives, "want" means to lack something. Read it slowly; it rewards that.',
		license: PUBLIC_DOMAIN,
		homepage: 'https://www.ccel.org/ccel/henry/mhc1.html',
	},
	{
		id: 'jamieson-fausset-brown',
		name: 'Jamieson-Fausset-Brown Bible Commentary',
		shortName: 'Jamieson-Fausset-Brown',
		byline: 'Robert Jamieson, A. R. Fausset and David Brown, 1871',
		author: 'Robert Jamieson, A. R. Fausset and David Brown',
		about:
			'Three Scottish scholars working phrase by phrase through the whole Bible. Where a translation had to choose one English wording, they tell you what the Hebrew or Greek actually says and what the alternatives were. Useful when you want to know why two Bibles word the same verse differently.',
		readingNote:
			'Written in 1871 and organised around short quoted phrases followed by a dash, then the explanation. It reads more like reference notes than prose, and it assumes you have the verse in front of you.',
		license: PUBLIC_DOMAIN,
		homepage: 'https://www.ccel.org/ccel/jamieson/jfb.html',
	},
];

const byId = new Map(COMMENTARY_SOURCES.map((source) => [source.id, source]));

export function commentarySource(
	id: CommentarySourceId,
): CommentarySource | null {
	return byId.get(id) ?? null;
}

/**
 * One line of attribution carrying everything a licence requires: the work, who
 * holds it, the licence, and the fact that we changed the formatting. Rendered
 * next to the text it covers, never collected on some distant credits page,
 * because attribution that a reader has to go looking for is not attribution.
 */
export function attributionLine(source: CommentarySource): string {
	if (!source.license.holder) {
		return `${source.name} (${source.byline}). Public domain. Reformatted for the web by BibleHearth; wording unchanged.`;
	}
	return `${source.name} © ${source.license.holder}, licensed under ${source.license.name}. Reformatted for the web by BibleHearth; wording unchanged.`;
}
