import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** JHN.3 | JHN.3.16 | PHP.4.6-7 */
const USFM_REF = /^[A-Z0-9]{3}\.\d+(\.\d+(-\d+)?)?$/;

const verseEntry = z.object({
	usfm: z.string().regex(USFM_REF),
	/**
	 * One sentence: who is speaking, to whom, and why the verse belongs here.
	 *
	 * This is the moat. Every competitor publishes a bare verse list; the gloss
	 * is what makes each entry independently quotable, guards against
	 * proof-texting, and keeps most of the page's prose ours rather than the
	 * publisher's. Required, and length-checked, because it is the first thing
	 * anyone is tempted to skip.
	 */
	gloss: z.string().min(40).max(400),
});

const verseGroup = z.object({
	/** Anchor id, also the #fragment target. */
	id: z.string().regex(/^[a-z0-9-]+$/),
	/** Rendered as an <h2>. Make it a claim, never a label. */
	heading: z.string().min(4).max(90),
	/** Why these verses belong together. 1–2 sentences. */
	rationale: z.string().min(60).max(600),
	verses: z.array(verseEntry).min(2).max(8),
});

const topics = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/topics' }),
	schema: z.object({
		/** "Anxiety" — the entity, not the query string. */
		title: z.string().min(2).max(60),
		/** Query variants; powers related-topic matching and internal search. */
		aliases: z.array(z.string()).default([]),
		/**
		 * 40–90 words, rendered directly under the <h1> before anything else.
		 * The single highest-leverage element on the page: it is the chunk a
		 * featured snippet or a retrieval model lifts whole.
		 */
		shortAnswer: z.string().min(200).max(700),
		groups: z.array(verseGroup).min(2).max(6),
		/** The honest paragraph nobody else writes. Highest-trust signal here. */
		misuse: z.string().min(200).max(1400).optional(),
		faqs: z
			.array(
				z.object({
					q: z.string().min(10).max(140),
					/** Self-contained. No "as mentioned above" — it must stand alone. */
					a: z.string().min(120).max(800),
				}),
			)
			.max(6)
			.default([]),
		related: z.array(reference('topics')).max(8).default([]),
		/** Entity linking: cheapest, highest-value AEO field in this schema. */
		entity: z
			.object({
				name: z.string(),
				sameAs: z.array(z.string().url()).default([]),
			})
			.optional(),
		sources: z
			.array(z.enum(['naves', 'torreys', 'openbible-xrefs', 'editorial']))
			.default(['editorial']),
		publishedAt: z.coerce.date(),
		reviewedAt: z.coerce.date(),
		/** Draft topics render noindex and stay out of sitemaps. */
		draft: z.boolean().default(false),
	}),
});

export const collections = { topics };
