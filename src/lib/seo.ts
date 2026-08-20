import { truncateWords } from './bible/text';
import { absoluteMediaUrl, absoluteUrl } from './bible/urls';
import {
	ABOUT_PATH,
	EDITORIAL_EMAIL,
	PUBLISHING_SINCE,
	SITE_NAME,
	SITE_PROFILES,
	SITE_TOPICS,
} from './site';

/**
 * The social card a page falls back to, and its real dimensions.
 *
 * Here rather than in BaseLayout because two things need it: the `og:image`
 * the layout emits, and the `image` on the `Article` node. Those must be the
 * same URL. Editorial pages pass a 1200×630 crop of their figure instead;
 * this stays as the fallback for reader pages, verse hubs, and unbriefed
 * chapters, which have no picture of their own.
 */
export const DEFAULT_OG_IMAGE = '/og-default.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

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
	return best;
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

/**
 * The character budget for a meta description whose reason to click sits at
 * the end of the string.
 *
 * Search results display around this length. They do not penalise a longer
 * field, but they do cut it, and the cut is from the right. Editorial pages
 * that front-load their own writing can run longer — the chapter study does,
 * on purpose — because the distinctive sentence is already on screen when the
 * rest falls off. A verse hub's translations are the opposite: they are the
 * reason to click, they come after the verse, and they are invisible if the
 * string overruns.
 */
export const DESCRIPTION_MAX = 155;

/**
 * How much of a verse a description may lead with.
 *
 * Front-loaded on the verse rather than on what the page is, because the
 * opening words are the only part of this string that is not identical across
 * 31,103 hubs — and a meta description that opens with a hundred characters of
 * boilerplate is one Google replaces with its own. Wide enough for a real
 * clause; `descriptionWithClause` still shrinks this when the reference and
 * the abbreviation list would not otherwise fit.
 */
const DESCRIPTION_LEAD_MAX = 64;

/**
 * A distinctive lead, the page's claim, and an optional close, inside one
 * description.
 *
 * `body` is the reason to click and has to survive the display cut. The lead
 * is sized against whatever budget `body` leaves, so a long reference cannot
 * spend the translations' characters. `extra` is true of every page of this
 * shape and is the first thing dropped; spending verse on it would buy a
 * sentence no result is waiting for. When even `body` overruns, a word-
 * boundary cut is the last resort rather than a mid-word one.
 */
export function descriptionWithClause(
	snippet: string,
	body: string,
	extra = '',
	max = DESCRIPTION_MAX,
): string {
	const separator = ' — ';
	const leadBudget = Math.min(
		DESCRIPTION_LEAD_MAX,
		Math.max(0, max - body.length - separator.length),
	);
	const lead = clauseWithin(snippet, leadBudget);
	const core = lead ? `${lead}${separator}${body}` : body;
	if (extra) {
		const withExtra = `${core} ${extra}`;
		if (withExtra.length <= max) {
			return withExtra;
		}
	}
	if (core.length <= max) {
		return core;
	}
	return truncateWords(core, max);
}

export type BreadcrumbItem = {
	name: string;
	path: string;
};

export function breadcrumbJsonLd(
	site: URL | undefined,
	items: readonly BreadcrumbItem[],
): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			item: absoluteUrl(site, item.path),
		})),
	};
}

export function creativeWorkJsonLd(options: {
	name: string;
	description?: string;
	inLanguage?: string;
	copyrightNotice?: string | null;
}): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'CreativeWork',
		name: options.name,
		...(options.description ? { description: options.description } : {}),
		...(options.inLanguage ? { inLanguage: options.inLanguage } : {}),
		...(options.copyrightNotice
			? { copyrightNotice: options.copyrightNotice }
			: {}),
	};
}

/**
 * Ordered list of the verses a topic cites.
 *
 * Neither BibleGateway nor BibleHub emits any structured data, so this is
 * uncontested ground. It carries references and links only — never scripture
 * text, which would turn the page into a bulk-extraction endpoint for licensed
 * content with no attribution attached.
 */
export function itemListJsonLd(options: {
	name: string;
	items: readonly { name: string; url: string }[];
}): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		name: options.name,
		numberOfItems: options.items.length,
		itemListElement: options.items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			url: item.url,
		})),
	};
}

export function articleJsonLd(options: {
	site: URL | undefined;
	path: string;
	headline: string;
	description: string;
	datePublished: Date;
	dateModified: Date;
	about?: { name: string; sameAs?: string[] };
	/**
	 * Works quoted on the page, as `CreativeWork` nodes.
	 *
	 * Chapter study pages carry three commentaries by named authors, and naming
	 * them in the markup is the difference between a page that looks scraped and
	 * one that shows its sources. It is also the only machine-readable place the
	 * Tyndale licence can be stated.
	 */
	citation?: readonly {
		name: string;
		author?: string;
		license?: string;
		url?: string;
	}[];
	/**
	 * The card that represents this article. Defaults to the site's.
	 *
	 * Pass the same value the page gives BaseLayout, or neither, so the two
	 * cannot drift — see DEFAULT_OG_IMAGE.
	 */
	image?: string;
	/** Caption, credit, licence — only when `image` is a work we are hosting. */
	imageCaption?: string;
	imageCreditText?: string;
	imageLicense?: string;
	imageSourceUrl?: string;
}): Record<string, unknown> {
	const url = absoluteUrl(options.site, options.path);
	return {
		'@context': 'https://schema.org',
		'@type': 'Article',
		'@id': `${url}#article`,
		headline: options.headline,
		description: options.description,
		url,
		mainEntityOfPage: url,
		datePublished: options.datePublished.toISOString(),
		dateModified: options.dateModified.toISOString(),
		isAccessibleForFree: true,
		image: {
			'@type': 'ImageObject',
			url: absoluteMediaUrl(options.site, options.image ?? DEFAULT_OG_IMAGE),
			width: OG_IMAGE_WIDTH,
			height: OG_IMAGE_HEIGHT,
			...(options.imageCaption ? { caption: options.imageCaption } : {}),
			...(options.imageCreditText
				? { creditText: options.imageCreditText }
				: {}),
			...(options.imageLicense ? { license: options.imageLicense } : {}),
			...(options.imageSourceUrl
				? { acquireLicensePage: options.imageSourceUrl }
				: {}),
		},
		author: organizationRef(options.site),
		// An id reference, not a second copy: `author` above defines the node in
		// this same document, and the About page defines it in full under the
		// same id.
		publisher: { '@id': organizationId(options.site) },
		...(options.about
			? {
					about: {
						'@type': 'Thing',
						name: options.about.name,
						...(options.about.sameAs?.length
							? { sameAs: options.about.sameAs }
							: {}),
					},
				}
			: {}),
		...(options.citation?.length
			? {
					citation: options.citation.map((source) => ({
						'@type': 'CreativeWork',
						name: source.name,
						...(source.author
							? { author: { '@type': 'Person', name: source.author } }
							: {}),
						...(source.license ? { license: source.license } : {}),
						...(source.url ? { url: source.url } : {}),
					})),
				}
			: {}),
	};
}

/**
 * FAQ rich results were deprecated in 2026, so this earns no SERP treatment.
 * It is emitted anyway because it is free, still valid schema, and the
 * question/answer shape is what retrieval models chunk on.
 */
export function faqJsonLd(
	faqs: readonly { q: string; a: string }[],
): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map((faq) => ({
			'@type': 'Question',
			name: faq.q,
			acceptedAnswer: { '@type': 'Answer', text: faq.a },
		})),
	};
}

/**
 * The one entity every article on this site names as its author and publisher.
 *
 * A stable `@id` rather than a description repeated per page: the About page
 * emits this organisation in full — contact address, publishing principles,
 * what it writes about — and every article carries a reference under the same
 * id, so a crawler resolves the lot into one publisher instead of forty
 * unrelated nodes that happen to share a name. Which is the whole point of
 * having an About page: without it, the site is forty pages with nobody behind
 * them.
 */
export function organizationId(site: URL | undefined): string {
	return `${absoluteUrl(site, '/')}#organization`;
}

/**
 * The compact reference embedded in an article, rather than the full node.
 *
 * It carries name and url alongside the id so it still says something if the
 * About page is never crawled. `Article` wants an author, and until this site
 * puts a person's name to the writing, the publisher is the honest answer to
 * who wrote it — the usual alternative in the wild is an invented byline, which
 * is worse than none.
 */
export function organizationRef(
	site: URL | undefined,
): Record<string, unknown> {
	return {
		'@type': 'Organization',
		'@id': organizationId(site),
		name: SITE_NAME,
		url: absoluteUrl(site, '/'),
	};
}

/**
 * The publisher, stated once and in full, on the About page.
 *
 * `publishingPrinciples` points back at the page carrying this node, which is
 * not circular so much as the point: it is the machine-readable claim that the
 * standards this site works to are written down and public, at that URL.
 *
 * `sameAs` is omitted rather than emitted empty — see lib/site.ts.
 */
export function organizationJsonLd(options: {
	site: URL | undefined;
	description: string;
}): Record<string, unknown> {
	const home = absoluteUrl(options.site, '/');
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'@id': organizationId(options.site),
		name: SITE_NAME,
		url: home,
		description: options.description,
		email: EDITORIAL_EMAIL,
		foundingDate: PUBLISHING_SINCE,
		publishingPrinciples: absoluteUrl(options.site, ABOUT_PATH),
		knowsAbout: [...SITE_TOPICS],
		logo: {
			'@type': 'ImageObject',
			url: absoluteUrl(options.site, '/apple-touch-icon.png'),
			width: 180,
			height: 180,
		},
		contactPoint: {
			'@type': 'ContactPoint',
			contactType: 'editorial',
			email: EDITORIAL_EMAIL,
			availableLanguage: 'English',
		},
		...(SITE_PROFILES.length ? { sameAs: [...SITE_PROFILES] } : {}),
	};
}

/**
 * One of the pages that says who is behind this site, rather than teaching
 * something: About, Contact, the privacy policy.
 *
 * None of these types earns a rich result. `AboutPage` and `ContactPage` are
 * here because they are the one unambiguous way to say which URL answers "who
 * runs this" and "how do I reach them" — questions a search engine otherwise
 * has to guess at from a footer link and a word in a title. Each points at the
 * same Organization as its `mainEntity`, so the three read as one publisher
 * described from three angles.
 *
 * `dateModified` is optional and only worth passing where the date is part of
 * what the page says. A privacy policy with no date is a privacy policy nobody
 * can tell is current; an About page with a stale one is worse than none.
 */
export function sitePageJsonLd(options: {
	site: URL | undefined;
	path: string;
	type: 'AboutPage' | 'ContactPage' | 'WebPage';
	name: string;
	description: string;
	dateModified?: Date;
}): Record<string, unknown> {
	const url = absoluteUrl(options.site, options.path);
	return {
		'@context': 'https://schema.org',
		'@type': options.type,
		'@id': `${url}#page`,
		url,
		name: options.name,
		description: options.description,
		inLanguage: 'en',
		isAccessibleForFree: true,
		...(options.dateModified
			? { dateModified: options.dateModified.toISOString() }
			: {}),
		mainEntity: { '@id': organizationId(options.site) },
		publisher: { '@id': organizationId(options.site) },
	};
}

/**
 * The site itself, emitted once on the home page.
 *
 * This is the node that gives a search engine a site name to show instead of a
 * guess at one from the domain, and it is what the home page carried nothing of
 * before: its only structured data was a `BreadcrumbList` naming the home page
 * as the sole crumb, which says the page is where it already is.
 *
 * `publisher` is the compact organisation reference rather than the full node.
 * The About page defines that organisation in full under the same `@id`, so a
 * crawler that reads both resolves one publisher; a crawler that reads only this
 * page still gets a name and a URL rather than a dangling id.
 *
 * No `potentialAction`/`SearchAction`, deliberately. It is the conventional
 * addition here and it is a claim that a query template resolves to a working
 * search endpoint — this site has no search route, so the markup would describe
 * a URL that 404s. It goes in when search does.
 */
export function websiteJsonLd(options: {
	site: URL | undefined;
	description: string;
}): Record<string, unknown> {
	const url = absoluteUrl(options.site, '/');
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'@id': `${url}#website`,
		name: SITE_NAME,
		url,
		description: options.description,
		inLanguage: 'en',
		isAccessibleForFree: true,
		publisher: organizationRef(options.site),
	};
}
