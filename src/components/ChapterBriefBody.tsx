import type { BiblePassage, BibleVersion } from '@youversion/platform-core';
import CopyrightNotice from './CopyrightNotice';
import Passage from './Passage';
import Figure from './Figure';
import type { ChapterBrief } from '../lib/commentary';
import { displayChapterNumber } from '../lib/bible/psalms';
import { localeReference } from '../lib/bible/refs';
import { bookSlugFromUsfm } from '../lib/bible/usfm';
import { topicPath } from '../lib/topics/paths';
import type { EditorialFigure } from '../lib/images/types';
import { DEFAULT_LOCALE, type Locale } from '../lib/i18n/locales';
import { strings } from '../lib/i18n/strings';
type Props = {
	scripture?: React.ReactNode;
	children?: React.ReactNode;
	/** Publisher whose text is used in `passages`, when available. */
	version?: Pick<BibleVersion, 'copyright' | 'info' | 'publisher_url' | 'title'> | null;
	brief: Pick<ChapterBrief, 'data'>;
	/** Scripture for `keyVerses`, keyed by USFM. Loaded by the page. */
	passages: Map<string, BiblePassage | null>;
	/** "Genesis 1" — used in headings so each one reads standalone. */
	reference: string;
	/** Resolved related topics, already filtered to published ones. */
	relatedTopics: readonly { slug: string; title: string }[];
	/** Anchor href for the commentary section, for the outline's jump link. */
	firstSourceAnchor: string | null;
	/**
	 * Whether the page passed a `scripture` slot. Drives the jump link only —
	 * the slot renders either way, and an empty one is simply nothing.
	 */
	hasFullText?: boolean;
	/**
	 * The locale this brief is written in. Drives the section headings only —
	 * everything else on this component comes from the brief itself, which is
	 * already in the right language because it is a separate file per locale.
	 */
	locale?: Locale;
};

export default function ChapterBriefBody(props: Props) {
	const {
		brief,
		passages,
		reference,
		relatedTopics,
		firstSourceAnchor,
		hasFullText = false,
		locale = DEFAULT_LOCALE,
	} = props;
	const { data } = brief;
	const t = strings(locale);

	const [bookUsfm, chapterId = '1'] = data.usfm.split('.');
	// Routes take the URL slug, never the USFM id: `1CO` addresses
	// /verse/1-corinthians/..., and deriving it from the filename would split
	// `1-corinthians-13` at the first hyphen and produce `/verse/1/...`.
	const bookSlug = bookSlugFromUsfm(bookUsfm ?? '');
	// The chapter number as this locale writes it, for the outline's own labels.
	const shownChapter = displayChapterNumber(locale, bookUsfm ?? '', chapterId);
	return (
		<>
			{/* Answer-first. This paragraph is what a featured snippet quotes and what an
    AI answer lifts whole, so it says what the chapter is about in its first
    sentence and never warms up to the point. */}
			<p className="lede">{data.shortAnswer}</p>

			{data.figure ? <Figure figure={data.figure as EditorialFigure} /> : null}

			<nav className="brief-jump" aria-label={t.onThisPage}>
				{hasFullText ? <a href="#text">{t.jump.fullText}</a> : null}
				<a href="#outline">{t.jump.outline}</a>
				<a href="#themes">{t.jump.themes}</a>
				{data.glossary.length ? <a href="#words">{t.jump.glossary}</a> : null}
				{data.keyVerses.length ? <a href="#key-verses">{t.jump.keyVerses}</a> : null}
				{data.caution ? <a href="#caution">{t.jump.caution}</a> : null}
				<a href="#questions">{t.jump.questions}</a>
				{firstSourceAnchor ? <a href={firstSourceAnchor}>{t.jump.commentary}</a> : null}
			</nav>

			{/* The chapter itself, supplied by the page because loading scripture is its
    job, not this component's. Someone who searched the reference wants to read
    it before they read anything about it. */}
			{props.scripture ?? props.children}

			<section className="chapter-outline" id="outline">
				<h2>{t.outline(reference)}</h2>
				<ol className="outline-list">
					{data.outline.map((entry) => (
						<li key={entry.verses}>
							<a
								className="outline-ref"
								href={`/verse/${bookSlug}/${chapterId}/${entry.verses.split('-')[0]}`}
							>
								{shownChapter}:{entry.verses}
							</a>
							<h3>{entry.heading}</h3>
							<p>{entry.note}</p>
						</li>
					))}
				</ol>
			</section>

			<section className="chapter-themes" id="themes">
				<h2>{t.themes(reference)}</h2>
				{data.themes.map((theme) => (
					<div className="theme-item" key={theme.name}>
						<h3>{theme.name}</h3>
						<p>{theme.explanation}</p>
					</div>
				))}
			</section>

			{data.glossary.length ? (
				<section className="chapter-glossary" id="words">
					<h2>{t.glossary(reference)}</h2>
					<p className="muted">{t.glossaryIntro}</p>
					<dl className="glossary-list">
						{data.glossary.map((item) => (
							<div className="glossary-item" key={item.term}>
								<dt>{item.term}</dt>
								<dd>{item.plain}</dd>
							</div>
						))}
					</dl>
				</section>
			) : null}

			{data.keyVerses.length ? (
				<section className="chapter-key-verses" id="key-verses">
					<h2>{t.keyVerses(reference)}</h2>
					{data.keyVerses.map((verse) => {
						const passage = passages.get(verse.usfm);
						const [book, chapter, versePart] = verse.usfm.split('.');
						const first = versePart?.split('-')[0];
						const href =
							book && chapter && first
								? `/verse/${bookSlugFromUsfm(book)}/${chapter}/${first}`
								: null;
						return (
							<article className="verse-card" key={verse.usfm}>
								<h3>
									{href ? (
										<a href={href}>{localeReference(locale, verse.usfm)}</a>
									) : (
										localeReference(locale, verse.usfm)
									)}
								</h3>
								{passage ? <Passage html={passage.content} /> : null}
								<p className="gloss">{verse.why}</p>
							</article>
						);
					})}
					{!hasFullText &&
					props.version &&
					data.keyVerses.some((verse) => passages.get(verse.usfm)) ? (
						<CopyrightNotice version={props.version} />
					) : null}
				</section>
			) : null}

			{data.caution ? (
				<section className="chapter-caution" id="caution">
					<h2>{t.caution(reference)}</h2>
					<p>{data.caution}</p>
				</section>
			) : null}

			{/* The last section of our own writing, so the moment it comes into view is
    the closest thing this site has to a conversion: the reader came for the
    chapter and stayed through the summary, the outline and the rest. `text`
    rides along because it answers a question nothing else can — whether
    spending a metered passage fetch on the full chapter changes how far down
    the page people get. */}
			<section
				className="chapter-faq"
				id="questions"
				data-va-view="brief-end"
				data-va-text={hasFullText ? 'yes' : 'no'}
			>
				<h2>{t.faqs(reference)}</h2>
				{data.faqs.map((faq) => (
					<div className="faq-item" key={faq.q}>
						<h3>{faq.q}</h3>
						<p>{faq.a}</p>
					</div>
				))}
			</section>

			{relatedTopics.length ? (
				<section className="chapter-topics">
					<h2>{t.relatedTopics}</h2>
					<ul className="topic-links">
						{relatedTopics.map((topic) => (
							<li key={topic.slug}>
								<a href={topicPath(topic.slug)}>{t.relatedTopicLink(topic.title)}</a>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</>
	);
}
