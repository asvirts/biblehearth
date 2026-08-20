/**
 * The locale is resolved once, in middleware, and read everywhere else.
 *
 * Every page that renders in more than one language takes it from here rather
 * than parsing `Astro.url` itself. That is the point of putting it on `locals`:
 * by the time a page runs, the locale prefix has already been stripped from the
 * path it matched, so a page inspecting the URL would see `/salmo/91` and
 * conclude it was English. The prefix is gone precisely so that one set of
 * route files can serve all 58 locales, and `locals.locale` is the only
 * surviving record of which one asked.
 *
 * Never optional. Middleware resolves it for every request and falls back to
 * English, so a page needs no null check and cannot accidentally treat "no
 * locale" as a third state alongside English and everything else.
 */
declare namespace App {
	interface Locals {
		/** The locale this request belongs to. English when no prefix matched. */
		locale: import('./lib/i18n/locales').Locale;
		/**
		 * The path within the locale, with the prefix removed — `/salmo/91` for
		 * `/es/salmo/91`, and identical to the pathname for English.
		 *
		 * Here so that anything needing to rebuild a sibling URL (the language
		 * switcher, `hreflang`) can hand this straight to `localePath` with a
		 * different locale, rather than re-deriving it from a URL that no longer
		 * carries the prefix.
		 */
		localePath: string;
	}
}
