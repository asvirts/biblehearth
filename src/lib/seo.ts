import { absoluteUrl } from './bible/urls';

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
