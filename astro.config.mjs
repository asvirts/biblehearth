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
	adapter: vercel({
		webAnalytics: {
			enabled: true,
		},
	}),
	/**
	 * The study pages moved from `/commentary/psalms/28` to `/psalms/28`.
	 *
	 * The old prefix narrowed the page's promise to the one section a reader is
	 * least likely to have searched for: the page carries the chapter itself, a
	 * summary, an outline, a glossary and an FAQ, and "commentary" describes
	 * none of that. The move happened while six chapters had briefs and the
	 * other ~1,100 URLs were `noindex`, which is the cheapest this migration
	 * will ever be.
	 *
	 * 301 rather than 302: the old paths are not coming back, and anything that
	 * has already linked or indexed them should follow permanently.
	 */
	redirects: {
		'/commentary': { status: 301, destination: '/study' },
		'/commentary/[book]': { status: 301, destination: '/[book]' },
		'/commentary/[book]/[chapter]': {
			status: 301,
			destination: '/[book]/[chapter]',
		},
	},
	env: {
		schema: {
			YVP_APP_KEY: envField.string({
				context: 'server',
				access: 'secret',
				optional: true,
			}),
			/**
			 * Set by Vercel on every scheduled invocation of /api/warm, and
			 * checked there before the endpoint spends any API quota. Optional
			 * so a build without it still succeeds; the endpoint refuses to run
			 * rather than running unsecured.
			 */
			CRON_SECRET: envField.string({
				context: 'server',
				access: 'secret',
				optional: true,
			}),
			/**
			 * Proves ownership of the domain to Bing Webmaster Tools.
			 *
			 * An env var rather than a file in public/, because unlike the
			 * IndexNow key this string is not meant to be discoverable and is
			 * not shared with anyone: it is a token tied to one Microsoft
			 * account. Public access rather than secret because it is emitted
			 * into every page's head, which is the whole point of it.
			 *
			 * Optional so a build without it still succeeds — the tag is simply
			 * omitted. Paste the value from Bing Webmaster Tools → Add site →
			 * "HTML Meta Tag" (the `content` attribute only) into the Vercel
			 * project's environment variables.
			 */
			BING_SITE_VERIFICATION: envField.string({
				context: 'server',
				access: 'public',
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
