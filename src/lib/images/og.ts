import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '../seo';
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
 * A 1200×630 cover crop of the page figure, for Open Graph and the Article
 * image. The on-page figure keeps its own aspect; this crop is only the card.
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
	const og = await getImage({
		src: figure.src,
		width: OG_IMAGE_WIDTH,
		height: OG_IMAGE_HEIGHT,
		fit: 'cover',
		format: 'jpg',
	});
	return {
		image: og.src,
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
