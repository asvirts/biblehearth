import { absoluteUrl } from './bible/urls';

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
