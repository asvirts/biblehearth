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
 * The character budget for a `<title>`.
 *
 * Bing Webmaster Tools reports anything longer as an error rather than a hint,
 * and Google truncates around the same point, so the ceiling is real on both
 * sides. Sixty-five is Bing's line; we aim under it rather than at it.
 */
export const TITLE_MAX = 65;

/**
 * A title made of the part that must be there and a Scripture snippet that only
 * earns its place if the whole thing fits.
 *
 * `head` carries the query — the reference, the translation, what the page is.
 * The snippet is a bonus: a reader searching a half-remembered phrase can match
 * on it, which is worth real traffic on a reader page. But it is all or
 * nothing. A snippet cut to fit produces the exact string this function exists
 * to prevent — "From the rising of the sun to the…", "The Hall of Faith Turns
 * Over Halfway Through" — which is not a phrase anyone searches, reads as
 * broken text in a result, and spends the budget the reference needed. So a
 * short verse comes through whole ("John 11:35 NIV — Jesus wept.") and a long
 * one is left to the description, where there is room to finish the sentence.
 */
export function titleWithSnippet(
	head: string,
	snippet: string,
	max = TITLE_MAX,
): string {
	// A clause that happens to end mid-sentence keeps its full stop but loses a
	// dangling comma — "Rejoice always," reads like a mistake in a result list.
	const clean = snippet
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[,;:]+$/, '');
	if (!clean) {
		return head;
	}
	const whole = `${head} — ${clean}`;
	return whole.length <= max ? whole : head;
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
