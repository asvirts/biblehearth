import { GENERATED_LOCALES } from './locales.generated';

/**
 * Every language this site publishes in, and everything that differs between
 * them.
 *
 * One table, because a locale is not one fact — it is a URL prefix, an
 * `hreflang`, a text direction, a language range the upstream API understands,
 * and a set of Bible versions. Those disagree with each other often enough that
 * deriving any one from another is a bug waiting for a specific language:
 * Tagalog is `tl` in a URL and `fil` to the API, Akan and Twi are two locales
 * sharing the API tag `ak`, Sorani Kurdish is filed under Kurdish's `ku_IQ` and
 * is neither Kurmanji nor left-to-right, and Portuguese is `pt` here and `por`
 * in the warehouse. Naming each field per locale is the only version of this
 * that cannot drift.
 *
 * The rows themselves are generated — see scripts/generate-locales.mjs, which
 * intersects the versions Biblica publishes with the versions this app key is
 * licensed to serve. Adding a language is re-running that script and
 * `npm run books:generate`, then writing the locale's edition page. Nothing
 * else in the app hardcodes a language.
 */

/**
 * The URL prefix, and the id every other module refers to a locale by.
 *
 * A plain string rather than a union, because the union would have to be
 * regenerated with the table and a stale one would reject a locale that exists.
 * `localeForCode` returning null is the check that actually holds.
 */
export type LocaleCode = string;

export type Locale = {
	code: LocaleCode;
	/**
	 * The path segment this locale lives under — `/es/salmos/91`.
	 *
	 * Empty for English, which stays at the root because that is where it has
	 * always been indexed. Moving it to `/en/` would 301 every URL the site has
	 * ever had for a tidiness nobody searching for it can see.
	 */
	prefix: string;
	/** `<html lang>`, `hreflang`, and `og:locale`. BCP-47. */
	htmlLang: string;
	/**
	 * What to pass `getVersions()`.
	 *
	 * Diverges from `code` for exactly one locale so far — Tagalog is `fil`
	 * upstream — which is the reason this is a field and not `${code}*`.
	 */
	apiLanguageRange: string;
	dir: 'ltr' | 'rtl';
	/** The language's name in itself, for the switcher. Never the English name. */
	endonym: string;
	/** The language's name in English, for our own prose and for `alt` text. */
	englishName: string;
	/**
	 * The versions this locale carries, by upstream id.
	 *
	 * An allowlist, where English is a blocklist (`lib/bible/catalog.ts`). The
	 * inversion is deliberate: English was curated down from twenty versions we
	 * already had, so naming the rejects was the shorter list. A new locale
	 * starts from nothing, so naming what we carry is both shorter and safer —
	 * a version appearing upstream cannot silently add ~1,189 crawlable reader
	 * pages to a language, which is the cost that made the catalogue finite in
	 * the first place.
	 *
	 * `null` means "the whole range, minus the exclusions" and is English only.
	 */
	versionIds: readonly number[] | null;
	/**
	 * The version this locale reads in when the URL does not name one.
	 *
	 * Chosen by what people actually read, not by translation philosophy: in
	 * French, German, Arabic and Tagalog the Biblica edition below is the single
	 * most-read version in the language. In Spanish and Portuguese it is second
	 * — the RVR1960 and the NTLH are the leaders and neither is licensed to this
	 * app key, which is the largest single gap in this table and the one worth
	 * closing first.
	 */
	defaultVersionId: number;
	/**
	 * Whether this locale can render the whole Bible.
	 *
	 * `nt` is not a preference, it is the only Indonesian option: every
	 * Indonesian version on this key is New Testament or partial, because the
	 * Terjemahan Baru that 89% of Indonesian readers use is not licensed here.
	 * Callers use this to keep Old Testament routes out of the sitemap and out
	 * of the book list rather than serving a chapter with no text in it.
	 */
	scope: 'full_bible' | 'nt';
};

/**
 * English, hand-written, and every other locale from the generator.
 *
 * English is the only row not generated, for two reasons that both make it
 * genuinely different rather than merely first: it is a blocklist over a
 * twenty-version catalogue where every other locale is an allowlist over one or
 * two, and it is already indexed at the site root, so it is the one locale
 * whose prefix must stay empty. Generating it would overwrite both.
 *
 * Everything else comes from scripts/generate-locales.mjs — the intersection of
 * what Biblica publishes and what this app key is licensed to serve. Adding a
 * language is re-running that script, not editing this file.
 */
const ENGLISH: Locale = {
	code: 'en',
	prefix: '',
	htmlLang: 'en',
	apiLanguageRange: 'en*',
	dir: 'ltr',
	endonym: 'English',
	englishName: 'English',
	versionIds: null,
	defaultVersionId: 111,
	scope: 'full_bible',
};

export const LOCALES: readonly Locale[] = [ENGLISH, ...GENERATED_LOCALES];

export const DEFAULT_LOCALE: Locale = ENGLISH;

const byCode = new Map(LOCALES.map((locale) => [locale.code, locale]));
const byPrefix = new Map(
	LOCALES.filter((locale) => locale.prefix).map((locale) => [
		locale.prefix,
		locale,
	]),
);

/** Every locale except English, which is the one that has no prefix. */
export const TRANSLATED_LOCALES: readonly Locale[] = LOCALES.filter(
	(locale) => locale.code !== DEFAULT_LOCALE.code,
);

export function localeForCode(code: string): Locale | null {
	return byCode.get(code as LocaleCode) ?? null;
}

/**
 * The locale a first path segment names, if it names one.
 *
 * This is what makes `/es/...` reachable at all: `[book]/[chapter]` is the
 * greediest route in the app, so `/es/salmos` would otherwise resolve as the
 * book `es`, chapter `salmos`. The middleware asks this first and rewrites when
 * the answer is not null.
 */
export function localeForPrefix(segment: string): Locale | null {
	return byPrefix.get(segment) ?? null;
}

/**
 * Split a pathname into the locale it belongs to and the path within it.
 *
 * Returns English and the path unchanged when no prefix matches, so callers
 * never branch on "is this localised" — every path belongs to exactly one
 * locale and English is the one spelled by omission.
 */
export function splitLocalePath(pathname: string): {
	locale: Locale;
	rest: string;
} {
	const [, first = '', ...others] = pathname.split('/');
	const locale = localeForPrefix(first);
	if (!locale) {
		return { locale: DEFAULT_LOCALE, rest: pathname };
	}
	const rest = `/${others.join('/')}`;
	return { locale, rest: rest === '/' ? '/' : rest.replace(/\/$/, '') };
}

/**
 * A path inside a locale — `localePath(es, '/salmos/91')` → `/es/salmos/91`.
 *
 * Every link and every canonical goes through here rather than interpolating a
 * prefix, because English's prefix is empty and `${''}/x` and `/${''}/x` differ
 * by a slash that only shows up as a duplicate URL in a crawl report.
 */
export function localePath(locale: Locale, path: string): string {
	const normalized = path.startsWith('/') ? path : `/${path}`;
	if (!locale.prefix) {
		return normalized;
	}
	return normalized === '/'
		? `/${locale.prefix}`
		: `/${locale.prefix}${normalized}`;
}
