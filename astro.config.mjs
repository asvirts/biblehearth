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
			DEFAULT_BIBLE_ID: envField.number({
				context: 'server',
				access: 'public',
				default: 3034,
			}),
		},
	},
});
