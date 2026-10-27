import type { ImageMetadata } from './types';
import { figureCreditLine } from './types';

export type FigureShareCard = {
	image: string;
	imageAlt: string;
	imageCaption: string;
	imageCreditText: string;
	imageLicense: string;
	imageSourceUrl: string;
};

/**
 * A shareable public image URL for Open Graph and Article metadata.
 * The underlying image keeps its aspect ratio and should carry accurate dimensions.
 */
export async function shareCardFromFigure(figure: {
	src: ImageMetadata;
	alt: string;
	caption: string;
	credit: {
		title: string;
		creator: string;
		date?: string;
		holder: string;
		licenseUrl: string;
		sourceUrl: string;
	};
}): Promise<FigureShareCard> {
	return {
		image: figure.src.src,
		imageAlt: figure.alt,
		imageCaption: figure.caption,
		imageCreditText: figureCreditLine(figure.credit),
		imageLicense: figure.credit.licenseUrl,
		imageSourceUrl: figure.credit.sourceUrl,
	};
}

export function articleShareFields(share: FigureShareCard | undefined): {
	image?: string;
	imageCaption?: string;
	imageCreditText?: string;
	imageLicense?: string;
	imageSourceUrl?: string;
} {
	if (!share) return {};
	return {
		image: share.image,
		imageCaption: share.imageCaption,
		imageCreditText: share.imageCreditText,
		imageLicense: share.imageLicense,
		imageSourceUrl: share.imageSourceUrl,
	};
}
