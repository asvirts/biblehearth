import { getEntries } from 'astro:content';
import { answerPath, type Answer } from './answers';
import { chapterReference, formatReference } from './bible/refs';
import { absoluteUrl, verseHubPath } from './bible/urls';
import { chapterStudyPath, type ChapterBrief } from './commentary';
import { MARKDOWN_CACHE_CONTROL, NOTFOUND_CACHE_CONTROL } from './http';
import { topicPath, type Topic } from './topics';

/**
 * Markdown twins of the three pages whose substance is ours.
 *
 * The llms.txt convention asks for a clean markdown version of each page at the
 * same URL with `.md` appended. On most sites that is a rendering convenience.
 * Here it is a licensing decision, so it is worth stating the rule once:
 *
 * **These files carry the original writing and never the Scripture.**
 *
 * A chapter study page, a topic page and an answer page each interleave our
 * prose with passages fetched from a licensed publisher API. Reproducing those
 * passages as plain text would do three bad things at once: strip the copyright
 * notice the publisher requires beside their text (components/CopyrightNotice),
 * turn a static file into a free bulk-text endpoint for a translation we are
 * only licensed to display, and spend a metered fetch against a rate-limited app
 * key on every crawl — the exact cost the `Crawl-delay` in robots.txt exists to
 * spread out.
 *
 * Built from `src/content/*` alone, a twin costs nothing upstream and is
 * therefore *cheaper* to serve than the page it mirrors. Every citation becomes
 * a link to the verse hub, where the text and its notice are served together.
 *
 * The order of sections matches the HTML page in each case, so an agent reading
 * the twin and a reader reading the page meet the same argument in the same
 * sequence.
 */

const SCRIPTURE_NOTE =
	'_Scripture text is not reproduced in this file: the translations BibleHearth ' +
	'serves are licensed from their publishers and carry a required copyright ' +
	'notice that a stripped copy would lose. Every reference below links to the ' +
	'verse on the site, where the text and its notice are served together._';

/** Collapse a value into something safe to sit on one line of markdown. */
function inline(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

function heading(level: number, text: string): string {
	return `${'#'.repeat(level)} ${inline(text)}`;
}

function quote(text: string): string {
	return `> ${inline(text)}`;
}

function link(label: string, href: string): string {
	return `[${inline(label)}](${href})`;
}

/** `Romans 8:1` as a link to its verse hub, or bare when it has no hub. */
function citation(usfm: string, site: URL | undefined): string {
	const label = formatReference(usfm);
	const path = verseHubPath(usfm);
	return path ? link(label, absoluteUrl(site, path)) : label;
}

/**
 * The prose body of an entry, verbatim.
 *
 * This is already markdown, written by hand, and it is the one part of a page
 * that needs no transformation at all. It keeps its own `##` headings, which
 * sit level with the sections built above it — the same relationship they have
 * on the rendered page.
 */
function body(entry: { body?: string | undefined }): string | null {
	const text = entry.body?.trim();
	return text ? text : null;
}

/** Resolve topic references to links, dropping any that are unpublished. */
async function relatedTopicLinks(
	refs: readonly { collection: 'topics'; id: string }[],
	site: URL | undefined,
): Promise<string[]> {
	if (refs.length === 0) {
		return [];
	}
	const topics = await getEntries(refs);
	return topics
		.filter((topic) => topic && !topic.data.draft)
		.map((topic) =>
			link(
				`Bible verses about ${topic.data.title.toLowerCase()}`,
				absoluteUrl(site, topicPath(topic.id)),
			),
		);
}

function bullets(items: readonly string[]): string {
	return items.map((item) => `- ${item}`).join('\n');
}

/**
 * Provenance, and the pointer home.
 *
 * A twin travels further from its page than the page does — the whole point of
 * it is to be read somewhere else — so it says where it came from and when it
 * was last looked at, on the way out.
 */
function footer(canonical: string, reviewedAt: Date): string {
	const reviewed = reviewedAt.toISOString().slice(0, 10);
	return [
		'---',
		'',
		`Source: ${canonical}`,
		`Reviewed: ${reviewed}`,
		'Original writing © BibleHearth. Quoted Scripture is licensed from its publisher and is not included here.',
	].join('\n');
}

function document(blocks: readonly (string | null)[]): string {
	return `${blocks.filter(Boolean).join('\n\n')}\n`;
}

export async function chapterBriefMarkdown(
	brief: ChapterBrief,
	site: URL | undefined,
): Promise<string> {
	const { data } = brief;
	const [bookUsfm = '', chapterId = '1'] = data.usfm.split('.');
	const reference = chapterReference(bookUsfm, chapterId);
	const canonical = absoluteUrl(site, chapterStudyPath(bookUsfm, chapterId));
	const topics = await relatedTopicLinks(data.relatedTopics, site);

	return document([
		heading(1, data.title),
		quote(data.shortAnswer),
		SCRIPTURE_NOTE,

		heading(2, `${reference} outline, verse by verse`),
		...data.outline.flatMap((entry) => [
			heading(
				3,
				`${citation(`${bookUsfm}.${chapterId}.${entry.verses}`, site)} — ${entry.heading}`,
			),
			inline(entry.note),
		]),

		heading(2, `The main ideas in ${reference}`),
		...data.themes.flatMap((theme) => [
			heading(3, theme.name),
			inline(theme.explanation),
		]),

		data.glossary.length
			? heading(2, `Words in ${reference}, explained simply`)
			: null,
		data.glossary.length
			? bullets(
					data.glossary.map(
						(item) => `**${inline(item.term)}** — ${inline(item.plain)}`,
					),
				)
			: null,

		data.keyVerses.length ? heading(2, `Key verses in ${reference}`) : null,
		...data.keyVerses.flatMap((verse) => [
			heading(3, citation(verse.usfm, site)),
			inline(verse.why),
		]),

		data.caution
			? heading(2, `What ${reference} is often made to say, and does not`)
			: null,
		data.caution ? inline(data.caution) : null,

		heading(2, `Common questions about ${reference}`),
		...data.faqs.flatMap((faq) => [heading(3, faq.q), inline(faq.a)]),

		body(brief),

		topics.length ? heading(2, 'Related topics') : null,
		topics.length ? bullets(topics) : null,

		footer(canonical, data.reviewedAt),
	]);
}

export async function topicMarkdown(
	topic: Topic,
	site: URL | undefined,
): Promise<string> {
	const { data } = topic;
	const canonical = absoluteUrl(site, topicPath(topic.id));
	const related = await relatedTopicLinks(data.related, site);

	return document([
		heading(1, `Bible Verses About ${data.title}`),
		quote(data.shortAnswer),
		SCRIPTURE_NOTE,

		...data.groups.flatMap((group) => [
			heading(2, group.heading),
			inline(group.rationale),
			bullets(
				group.verses.map(
					(verse) => `${citation(verse.usfm, site)} — ${inline(verse.gloss)}`,
				),
			),
		]),

		data.misuse ? heading(2, 'What these verses do not mean') : null,
		data.misuse ? inline(data.misuse) : null,

		body(topic),

		data.faqs.length
			? heading(2, `Common questions about ${data.title.toLowerCase()}`)
			: null,
		...data.faqs.flatMap((faq) => [heading(3, faq.q), inline(faq.a)]),

		related.length ? heading(2, 'Related topics') : null,
		related.length ? bullets(related) : null,

		footer(canonical, data.reviewedAt),
	]);
}

export async function answerMarkdown(
	answer: Answer,
	site: URL | undefined,
): Promise<string> {
	const { data } = answer;
	const canonical = absoluteUrl(site, answerPath(answer.id));
	const anchorReference = formatReference(data.anchor.passage);
	const [anchorBook = '', anchorChapter = '1'] = data.anchor.chapter.split('.');
	const topics = await relatedTopicLinks(data.relatedTopics, site);

	return document([
		heading(1, data.question),
		quote(data.shortAnswer),
		SCRIPTURE_NOTE,

		heading(2, `The passage: ${anchorReference}`),
		`Read it in context: ${citation(data.anchor.passage, site)} · ${link(
			formatReference(data.anchor.chapter),
			absoluteUrl(site, chapterStudyPath(anchorBook, anchorChapter)),
		)}`,

		body(answer),

		heading(2, `The ${data.views.length} main readings, compared`),
		...data.views.flatMap((view) => [
			heading(3, view.name),
			inline(view.claim),
			bullets(
				view.verses.map(
					(verse) => `${citation(verse.usfm, site)} — ${inline(verse.gloss)}`,
				),
			),
			`**What supports it.** ${inline(view.support)}`,
			`**The strongest objection.** ${inline(view.objection)}`,
			view.held ? `**Held by:** ${inline(view.held)}` : null,
		]),

		data.bottomLine ? heading(2, 'Where the evidence leaves it') : null,
		data.bottomLine ? inline(data.bottomLine) : null,

		data.caution.length ? heading(2, `What ${anchorReference} does not say`) : null,
		...data.caution.map((paragraph) => inline(paragraph)),

		data.faqs.length
			? heading(2, `Common questions about the ${data.label}`)
			: null,
		...data.faqs.flatMap((faq) => [heading(3, faq.q), inline(faq.a)]),

		topics.length ? heading(2, 'Related topics') : null,
		topics.length ? bullets(topics) : null,

		footer(canonical, data.reviewedAt),
	]);
}

/**
 * `noindex`, deliberately.
 *
 * A twin is the same words as its page, so leaving it indexable enters the site
 * into a duplicate-content argument with itself over every query the page is
 * built to win. `noindex` keeps it fetchable by anything that follows the
 * `rel="alternate"` link or reads /llms.txt, and invisible to the ranked index
 * where it could only cannibalise. Nothing in robots.txt blocks it, because a
 * blocked URL is a URL whose `noindex` is never seen.
 */
export function markdownResponse(body: string): Response {
	return new Response(body, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Cache-Control': MARKDOWN_CACHE_CONTROL,
			'X-Robots-Tag': 'noindex',
		},
	});
}

/**
 * No twin, because there is no original writing to put in one.
 *
 * `/genesis/12.md` 404s for the same reason `/genesis/12` renders `noindex`:
 * without a brief the page is public-domain commentary four larger sites
 * already publish, and a markdown file containing only somebody else's work is
 * the least defensible thing this site could serve. A chapter earns its twin
 * the moment someone writes it up — the same lookup decides both.
 */
export function markdownNotFound(): Response {
	return new Response('Not found\n', {
		status: 404,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': NOTFOUND_CACHE_CONTROL,
			'X-Robots-Tag': 'noindex',
		},
	});
}
