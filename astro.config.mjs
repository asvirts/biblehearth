// @ts-check
import vercel from '@astrojs/vercel';
import { defineConfig, envField, passthroughImageService } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://biblehearth.online',
	output: 'server',
	trailingSlash: 'never',
	session: false,
	image: {
		service: passthroughImageService(),
	},
	adapter: vercel(),
	env: {
		schema: {
			YVP_APP_KEY: envField.string({
				context: 'server',
				access: 'secret',
				optional: true,
			}),
			/**
			 * The version the site reads in by default: the home page CTA, the
			 * Verse of the Day, and anywhere a version is not named in the URL.
			 * 111 is the NIV — the most-read English translation, so it is what
			 * a first-time visitor should land in.
			 */
			DEFAULT_BIBLE_ID: envField.number({
				context: 'server',
				access: 'public',
				default: 111,
			}),
		},
	},
});
