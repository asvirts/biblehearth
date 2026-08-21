import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { editorialFigureSchema } from './lib/images/schema';

/** JHN.3 | JHN.3.16 | PHP.4.6-7 */
const USFM_REF = /^[A-Z0-9]{3}\.\d+(\.\d+(-\d+)?)?$/;

const verseEntry = z.object({
	usfm: z.string().regex(USFM_REF),
	/**
	 * One sentence: who is speaking, to whom, and why the verse belongs here.
	 *
	 * A bare verse list leaves the reader to work out why each passage belongs.
	 * The gloss supplies that context and guards against proof-texting. It is
	 * required and length-checked because it carries most of the explanatory
	 * value of the entry.
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
	schema: ({ image }) =>
		z.object({
		/** "Anxiety" — the entity, not the query string. */
		title: z.string().min(2).max(60),
		figure: editorialFigureSchema(image).optional(),
		/** Query variants; powers related-topic matching and internal search. */
		aliases: z.array(z.string()).default([]),
		/**
		 * 40–90 words, rendered directly under the <h1> before anything else.
		 * Give the reader a direct, self-contained answer before the verse groups.
		 */
		shortAnswer: z.string().min(200).max(700),
		groups: z.array(verseGroup).min(2).max(6),
		/** A clear warning about a real misuse or limit of the selected verses. */
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

/**
 * One reading of a contested passage, stated the way its own defenders state
 * it — then the strongest objection to it, stated the way its critics do.
 *
	 * Treat the views evenly. A page that lists three readings and only argues
	 * against two is advocacy presented as explanation.
 */
const answerView = z.object({
	/** Anchor id, also the #fragment target. */
	id: z.string().regex(/^[a-z0-9-]+$/),
	/** "Fallen angels" — the label people search and argue under. */
	name: z.string().min(4).max(70),
	/** One sentence putting the claim in the view's own terms. */
	claim: z.string().min(60).max(400),
	/** What the view has going for it. One paragraph. */
	support: z.string().min(150).max(1400),
	/** The strongest objection. One paragraph, no strawman. */
	objection: z.string().min(150).max(1400),
	/** Who has held it, with dates where they carry weight. */
	held: z.string().min(40).max(500).optional(),
	/** Verses this reading leans on. Rendered in full, each with a gloss. */
	verses: z.array(verseEntry).min(2).max(6),
});

/**
 * A question people actually type, answered at length.
 *
 * Distinct from a topic: a topic collects verses about a subject, an answer
 * resolves a single question about a single passage. The two link into each
 * other and into the reader, which is the whole internal-link strategy.
 */
const answers = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/answers' }),
	schema: ({ image }) =>
		z.object({
		/** The <h1>, phrased as the query. "Who Are the Sons of God in Genesis 6?" */
		question: z.string().min(10).max(110),
		figure: editorialFigureSchema(image).optional(),
		/** "Sons of God in Genesis 6" — for cards, breadcrumbs, and back-links. */
		label: z.string().min(4).max(60),
		/** Other phrasings of the same question this page is meant to answer. */
		aliases: z.array(z.string()).default([]),
		/**
		 * 40–90 words, rendered directly under the <h1> and reused verbatim as the
		 * meta description (truncated). The first sentence should answer the
		 * question directly because it may appear in a search result.
		 */
		shortAnswer: z.string().min(200).max(900),
		/** The passage the question is about. */
		anchor: z.object({
			/** Chapter USFM, for the reader link and the reverse index: `GEN.6`. */
			chapter: z.string().regex(/^[A-Z0-9]{3}\.\d+$/),
			/** The range actually under discussion, rendered in full: `GEN.6.1-4`. */
			passage: z.string().regex(USFM_REF),
		}),
		views: z.array(answerView).min(2).max(5),
		/** Where the evidence leaves it, including anything still unresolved. */
		bottomLine: z.string().min(200).max(1600).optional(),
		/** What the passage does not say. Paragraphs, rendered in order. */
		caution: z.array(z.string().min(80).max(1200)).max(5).default([]),
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
		relatedTopics: z.array(reference('topics')).max(6).default([]),
		/** Entity linking: cheapest, highest-value AEO field in this schema. */
		entity: z
			.object({
				name: z.string(),
				sameAs: z.array(z.string().url()).default([]),
			})
			.optional(),
		publishedAt: z.coerce.date(),
		reviewedAt: z.coerce.date(),
		/** Draft answers render noindex and stay out of sitemaps. */
		draft: z.boolean().default(false),
	}),
});

/**
 * The original layer on a chapter study page.
 *
 * Everything else on that page is somebody else's work: three licensed
 * commentaries and two outbound links. This collection is the part that is ours,
 * and it is the only part that can rank. Matthew Henry is already published
 * verbatim on BibleHub, StudyLight, CCEL, Blue Letter Bible and Bible Study
 * Tools; republishing him again adds a reader service and zero search value. A
 * chapter competes on the strength of the fields below or it does not compete.
 *
	 * Two rules run through every field:
 *
 * 1. Write for someone in their first month of reading the Bible. Short
 *    sentences. No term used before it is explained. "Propitiation",
 *    "eschatology" and "federal headship" are not clarifications, they are new
 *    problems. If a sentence needs a seminary word, the sentence is wrong, not
 *    the reader.
	 * 2. Simple is not the same as vague. Name what the chapter says and the
	 *    details that support the explanation. Plain language should stay
	 *    concrete.
	 *
	 * Follow `docs/editorial-voice.md`: use a warm explainer voice, vary sentence
	 * rhythm, lead with the positive meaning, and avoid turning every paragraph
	 * into the same contrast.
 */
const chapterOutlineEntry = z.object({
	/** Verse range within this chapter: `1`, `3-13`. */
	verses: z.string().regex(/^\d+(-\d+)?$/),
	/** What happens in these verses. A sentence, not a label. */
	heading: z.string().min(6).max(90),
	/** Why it matters, in plain words. 1-2 sentences. */
	note: z.string().min(40).max(400),
});

const chapters = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/chapters' }),
	schema: ({ image }) =>
		z.object({
		/** Chapter USFM: `GEN.1`. The route, the reverse index and the sitemap
		 * entry all derive from this, so it is the only id the file carries. */
		usfm: z.string().regex(/^[A-Z0-9]{3}\.\d+$/),
		figure: editorialFigureSchema(image).optional(),
		/**
		 * The <h1>. Leads with the reference, because that is what people type,
		 * then says what the chapter is about rather than repeating "commentary".
		 */
		title: z.string().min(10).max(95),
		/**
		 * The `<title>`, when the `<h1>` above is too long to be one.
		 *
		 * Bing reports a title outside 25-65 characters as an error, and an `<h1>`
		 * has no such ceiling — it is read on the page, in full, by someone who has
		 * already arrived. So the two fields do different jobs, and most of the
		 * time one string can do both: leave this out and the `<h1>` is used.
		 *
		 * Past 60 characters it cannot, and there is no mechanical way down.
		 * Cutting "Hebrews 11: The Hall of Faith Turns Over Halfway Through Verse
		 * 35" to fit yields "...Turns Over Halfway Through" — a fragment nobody
		 * searches, which reads as broken text in a result. Only the person who
		 * wrote the claim can say which half of it is the claim, so the refinement
		 * below asks them rather than guessing.
		 *
		 * Same rules as `title`: lead with the reference, make a claim, and spend
		 * no words on "summary" or "commentary".
		 */
		seoTitle: z.string().min(25).max(60).optional(),
		/**
		 * 40-90 words, rendered directly under the <h1> and reused as the meta
		 * description. Answer "what is this chapter about?" in the first sentence
		 * and give enough context for the paragraph to stand alone.
		 */
		shortAnswer: z.string().min(200).max(750),
		/**
		 * The chapter in order, in verse ranges.
		 *
		 * This is the field that earns the "summary" and "outline" queries, and it
		 * is the one a reader scrolls to first. Ranges must cover the chapter
		 * without gaps — a reader using this to find a verse should never fall
		 * into a hole.
		 */
		outline: z.array(chapterOutlineEntry).min(2).max(14),
		/** The ideas worth carrying out of the chapter. */
		themes: z
			.array(
				z.object({
					name: z.string().min(3).max(70),
					explanation: z.string().min(80).max(700),
				}),
			)
			.min(2)
			.max(6),
		/**
		 * Church words this chapter forces on a reader, defined in one plain
		 * sentence each.
		 *
		 * A newcomer meets "covenant" and "atonement" here for the first time and
		 * many other sites assume they already know. Defining them in place is one
		 * of the most useful services this page can offer a new reader.
		 */
		glossary: z
			.array(
				z.object({
					term: z.string().min(2).max(50),
					/** No jargon inside the definition. That defeats the purpose. */
					plain: z.string().min(50).max(400),
				}),
			)
			.max(8)
			.default([]),
		/** The verses people arrive looking for, rendered in full. */
		keyVerses: z
			.array(
				z.object({
					usfm: z.string().regex(USFM_REF),
					/** Why this verse, and what it means where it sits. */
					why: z.string().min(60).max(500),
				}),
			)
			.max(6)
			.default([]),
		/**
		 * What this chapter is routinely made to say and does not say.
		 *
		 * The most-quoted chapters are often the most-misquoted. Correct the
		 * misunderstanding directly without turning the section into a performance
		 * of the site's discernment.
		 */
		caution: z.string().min(150).max(1500).optional(),
		/**
		 * Questions people actually type, answered so the answer stands alone.
		 * No "as mentioned above" — each one may be read in isolation.
		 */
		faqs: z
			.array(
				z.object({
					q: z.string().min(10).max(150),
					a: z.string().min(120).max(900),
				}),
			)
			.min(2)
			.max(8),
		relatedTopics: z.array(reference('topics')).max(6).default([]),
		/** Entity linking: cheapest, highest-value AEO field in this schema. */
		entity: z
			.object({
				name: z.string(),
				sameAs: z.array(z.string().url()).default([]),
			})
			.optional(),
		publishedAt: z.coerce.date(),
		reviewedAt: z.coerce.date(),
		/** Draft briefs render noindex and stay out of sitemaps. */
		draft: z.boolean().default(false),
	})
		/**
		 * Fail the build rather than ship a title Bing rejects.
		 *
		 * A `<title>` is the one field on the page nobody proofreads, because it is
		 * the one field that never appears on the page. Checking it here is the
		 * only way it stays checked: the next brief written is the one that would
		 * quietly reintroduce a 93-character title.
		 */
		.superRefine((brief, ctx) => {
			if (!brief.seoTitle && brief.title.length > 60) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['seoTitle'],
					message:
						`title is ${brief.title.length} characters, which is too long for a ` +
						'<title> (Bing errors past 65). Add a seoTitle of 25-60 characters ' +
						'that keeps the reference and the sharper half of the claim.',
				});
			}
		}),
});

export const collections = { topics, answers, chapters };
