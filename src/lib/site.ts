/**
 * Who publishes this site, in one place.
 *
 * The About page renders these values as text and the Organization node in
 * lib/seo.ts emits the same ones as structured data, so the two cannot drift
 * apart. That matters more here than it looks: a contact address that exists
 * only in schema, with nothing on the page a reader could use, is exactly the
 * pattern Google's quality raters are told to see through — the markup claims
 * an accountable publisher and the site does not have one.
 */
export const SITE_NAME = 'BibleHearth';
/** Public operator name confirmed by the site owner; not an author credential. */
export const SITE_OPERATOR = 'Andrew Virts';

export const ABOUT_PATH = '/about';
export const CONTACT_PATH = '/contact';
export const PRIVACY_PATH = '/privacy';

/** Deep-linked from the contact page, so the anchor is part of the contract. */
export const CORRECTIONS_ANCHOR = 'corrections';

/**
 * A real inbox, read by a person.
 *
 * On the domain rather than an address somewhere else, because the point of
 * publishing it is to tie this site to someone reachable; a free webmail
 * address undoes half of that. It needs forwarding set up before the page
 * ships — an address in an About page that bounces is worse than no address,
 * since it is the one claim on the page a stranger can test in ten seconds.
 */
export const EDITORIAL_EMAIL = 'hello@biblehearth.online';

/** Where the writing on this site started. Used as the founding date. */
export const PUBLISHING_SINCE = '2026-08';

/**
 * External profiles that corroborate who runs this, emitted as `sameAs`.
 *
 * Empty on purpose, and the schema omits the property rather than emitting an
 * empty array. `sameAs` is how a search engine ties a domain to an entity it
 * already knows about, which means it only pays when the profile at the other
 * end is real, current, and obviously the same publisher. A dormant account
 * proves nothing and invites a look nobody asked for. Adding one here puts it
 * in the Organization node and on the About page together.
 */
export const SITE_PROFILES: readonly string[] = [];

/**
 * What this site is about, for `knowsAbout`.
 *
 * Deliberately narrow. It is a claim about the subjects we publish original
 * writing on, not a list of everything the Bible touches.
 */
export const SITE_TOPICS: readonly string[] = [
	'Bible study',
	'Bible commentary',
	'Bible translations',
	'Christianity',
];
