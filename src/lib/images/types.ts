export type ImageMetadata = { src: string; width: number; height: number; format?: string };

export const FIGURE_LICENSES = {
	cc0: {
		id: 'cc0',
		name: 'CC0 1.0',
		url: 'https://creativecommons.org/publicdomain/zero/1.0/',
	},
	pd: {
		id: 'pd',
		name: 'Public domain',
		url: 'https://creativecommons.org/publicdomain/mark/1.0/',
	},
	'cc-by': {
		id: 'cc-by',
		name: 'CC BY 4.0',
		url: 'https://creativecommons.org/licenses/by/4.0/',
	},
	'cc-by-sa': {
		id: 'cc-by-sa',
		name: 'CC BY-SA 4.0',
		url: 'https://creativecommons.org/licenses/by-sa/4.0/',
	},
} as const;

export type FigureLicense = keyof typeof FIGURE_LICENSES;
export type FigureKind = 'art' | 'photograph';

export type FigureCredit = {
	title: string;
	creator: string;
	date?: string;
	holder: string;
	license: FigureLicense;
	licenseUrl: string;
	sourceUrl: string;
};

/**
 * One picture on an editorial page: the file, the sentence that says what it
 * is, and the credit that says whose it is.
 *
 * Content collections and the hub catalogue both produce this shape, so the
 * figure component, the Open Graph crop and the attributions page can take any
 * of them without a second mapping.
 */
export type EditorialFigure = {
	src: ImageMetadata;
	alt: string;
	caption: string;
	kind: FigureKind;
	credit: FigureCredit;
};

export function figureCreditLine(
	credit: Pick<FigureCredit, 'title' | 'creator' | 'date' | 'holder'>,
): string {
	const dated = credit.date ? `${credit.title} (${credit.date})` : credit.title;
	return `${dated}, ${credit.creator}. ${credit.holder}.`;
}

/**
 * The name printed next to the picture. Taken from the licence URL so a
 * 2.0 Geograph file is not credited as 4.0 just because the enum collapsed
 * the family.
 */
export function licenseDisplayName(license: FigureLicense | string, licenseUrl: string): string {
	try {
		const path = new URL(licenseUrl).pathname;
		const bySa = path.match(/\/licenses\/by-sa\/(\d+\.\d+)/);
		if (bySa) return `CC BY-SA ${bySa[1]}`;
		const by = path.match(/\/licenses\/by\/(\d+\.\d+)/);
		if (by) return `CC BY ${by[1]}`;
	} catch {
		// fall through to the enum label
	}
	return FIGURE_LICENSES[license as FigureLicense]?.name ?? String(license);
}

export function figureMarkdownCredit(figure: {
	credit: {
		title: string;
		creator: string;
		date?: string;
		holder: string;
		license: string;
		licenseUrl?: string;
		sourceUrl: string;
	};
}): string {
	const { credit } = figure;
	const dated = credit.date ? `${credit.title} (${credit.date})` : credit.title;
	const license = licenseDisplayName(credit.license, credit.licenseUrl ?? '');
	return `Illustration: [${dated}](${credit.sourceUrl}), ${credit.creator}. ${credit.holder}. ${license}.`;
}
