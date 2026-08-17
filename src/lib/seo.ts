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
