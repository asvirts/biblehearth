import { z } from 'zod';
import type { ImageMetadata } from './types';
import { FIGURE_LICENSES } from './types';

type ImageHelper = () => z.ZodType<ImageMetadata>;

const LICENSE_IDS = Object.keys(FIGURE_LICENSES) as Array<keyof typeof FIGURE_LICENSES>;

/**
 * The picture on a chapter, topic or answer. Same fields in every collection
 * so the figure component and the attributions page can iterate them.
 *
 * Optional. Pages render a figure when one is present and skip it when not —
 * published writing does not wait on a picture.
 */
export function editorialFigureSchema(image: ImageHelper) {
	return z.object({
		src: image(),
		/** What the picture shows, for anyone who cannot see it. */
		alt: z.string().min(20).max(180),
		/** One sentence on the page, under the picture, before the credit. */
		caption: z.string().min(20).max(240),
		kind: z.enum(['art', 'photograph']),
		credit: z.object({
			title: z.string().min(2).max(140),
			creator: z.string().min(2).max(120),
			date: z.string().min(1).max(40).optional(),
			holder: z.string().min(2).max(140),
			license: z.enum(LICENSE_IDS as [string, ...string[]]),
			licenseUrl: z.string().url(),
			sourceUrl: z.string().url(),
		}),
	});
}
