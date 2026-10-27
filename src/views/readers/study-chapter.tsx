import { strings } from '../../lib/i18n/strings';
import { Fragment } from 'react';
import PageLayout from '../../components/PageLayout';
import ChapterBriefBody from '../../components/ChapterBriefBody';
import CommentarySourceBlock from '../../components/CommentarySourceBlock';
import CopyrightNotice from '../../components/CopyrightNotice';
import ExternalStudyLinks from '../../components/ExternalStudyLinks';
import Passage from '../../components/Passage';
import RelatedQuestions from '../../components/RelatedQuestions';
import StatusMessage from '../../components/StatusMessage';
import { localeChapterReference } from '../../lib/bible/refs';
import { localePath } from '../../lib/i18n/locales';
import { chapterPath } from '../../lib/bible/urls';
import { bookStudyPath, chapterStudyPath, studyHubPath } from '../../lib/commentary/paths';
import { topicPath } from '../../lib/topics/paths';
import { displayAbbreviation } from '../../lib/bible/version-display';
import type { loadStudyChapter } from '../../loaders/readers/study-chapter';

type Model = Awaited<ReturnType<typeof loadStudyChapter>>;

export function renderStudyChapter(model: Model) {
	const {
		locale,
		bookUsfm,
		chapterId,
		bookName,
		reference,
		canonicalPath,
		displayNumber,
		commentaries,
		brief,
		alternates,
		numbering,
		version,
		readerLinks,
		passages,
		chapterText,
		shownSlug,
		otherVersions,
		chapterAnswers,
		relatedTopics,
		externalLinks,
		firstSourceAnchor,
		heading,
		title,
		description,
		indexable,
		share,
		jsonLd,
		reviewed,
		ogType,
		bodyHtml,
		hasPreviousStudy,
		hasNextStudy,
	} = model;
	const t = strings(locale);
	return (
		<PageLayout
			title={title}
			description={description}
			canonicalPath={canonicalPath}
			noindex={!indexable}
			markdown={indexable}
			lang={locale.htmlLang}
			dir={locale.dir}
			alternates={alternates}
			image={share?.image}
			imageAlt={share?.imageAlt}
			ogType={ogType}
			publishedTime={brief?.data.publishedAt}
			modifiedTime={brief?.data.reviewedAt}
			jsonLd={jsonLd}
		>
			<nav className="crumbs" aria-label="Breadcrumb">
				<a href={localePath(locale, '/')}>{t.home}</a>
				<span>/</span>
				<a href={studyHubPath(locale)}>{t.studyHub}</a>
				<span>/</span>
				<a href={bookStudyPath(bookUsfm, locale)}>{bookName}</a>
				<span>/</span>
				<span>{displayNumber}</span>
			</nav>

			<h1>{heading}</h1>

			{/* Which psalm this is in the other numbering, where the two disagree.
	    Sits directly under the h1 because a reader who came for «Псалом 90» and
	    is looking at a page about Psalm 91 needs it in the first thing they read,
	    not in a footnote. `shared` is the harder case — LXX 114 and 115 are two
	    halves of Hebrew 116 — and it gets its own wording rather than claiming an
	    equivalence that is not one. Rendered in the locale's own language via the
	    `lang`/`dir` on <html>, but the label itself is still English until the UI
	    strings are translated; see the note in lib/commentary/index.ts. */}
			{numbering ? (
				<p className="numbering-note">
					{numbering.shared
						? t.psalmNumberingShared(numbering.hebrew, numbering.septuagint)
						: t.psalmNumbering(numbering.hebrew)}
				</p>
			) : null}

			{/* Without the chapter on the page these links are the only way to read it,
	    so they sit above the fold. With it, they belong under the text as an
	    afterthought — see the scripture slot below. */}
			{!chapterText && readerLinks.length ? (
				<p className="read-in">
					{t.readIn(reference)}{' '}
					{readerLinks.map((link, index) => (
						<Fragment key={link.slug}>
							{index > 0 ? ' · ' : ''}
							{/* `from` is "none" because this block only renders on a page
						    with no scripture on it: the reader is not switching
						    translation, they are leaving to find one. Worth the same
						    event name either way — both answer which translation
						    people pick, which is what DEFAULT_VERSION_ID and
						    HUB_TRANSLATION_SLUGS currently guess at. */}
							<a
								href={chapterPath(link.slug, bookUsfm, chapterId, locale)}
								data-va="translation-switch"
								data-va-to={link.slug}
								data-va-from="none"
							>
								{link.label}
							</a>
						</Fragment>
					))}
				</p>
			) : null}

			{brief ? (
				<ChapterBriefBody
					brief={brief}
					version={version}
					passages={passages}
					reference={reference}
					relatedTopics={relatedTopics}
					firstSourceAnchor={firstSourceAnchor}
					hasFullText={Boolean(chapterText)}
					locale={locale}
				>
					{chapterText ? (
						<section className="chapter-text" id="text">
							<h2>
								{reference}
								{version ? ` (${displayAbbreviation(version)})` : ''}
							</h2>
							<Passage html={chapterText.content} />
							{otherVersions.length ? (
								<p className="read-in">
									{t.readInOther(reference)}{' '}
									{otherVersions.map((link, index) => (
										<Fragment key={link.slug}>
											{index > 0 ? ' · ' : ''}
											<a
												href={chapterPath(link.slug, bookUsfm, chapterId, locale)}
												data-va="translation-switch"
												data-va-to={link.slug}
												data-va-from={shownSlug}
											>
												{link.label}
											</a>
										</Fragment>
									))}
								</p>
							) : null}
							{version ? <CopyrightNotice version={version} /> : null}
						</section>
					) : null}
				</ChapterBriefBody>
			) : (
				<p className="lede">
					An original study of {reference} is still in progress. You can read notes from three
					commentaries below. Tyndale is the best place to begin if you prefer clear, modern
					English.
				</p>
			)}

			{bodyHtml !== null ? (
				<section className="chapter-notes">
					<div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
				</section>
			) : null}

			{commentaries.length ? (
				<div className="commentary-stack">
					<h2 className="commentary-stack-heading">{t.commentaries(reference)}</h2>
					<p className="muted">
						Each commentary appears in full with its author and license. Scripture references link
						to the corresponding verse on BibleHearth. The oldest commentary appears last.
					</p>
					{commentaries.map((entry, index) => (
						<CommentarySourceBlock
							key={entry.source.id}
							entry={entry}
							bookUsfm={bookUsfm}
							chapterId={chapterId}
							reference={reference}
							expanded={index === 0}
						/>
					))}
				</div>
			) : locale.prefix ? null : (
				/* A translated page has no commentary by design, so an empty stack there
			   is not an outage. Where it is one, the page already has its `<h1>`, and
			   a second is what the `notice` variant exists to avoid. */
				<StatusMessage
					variant="notice"
					title="Commentary is temporarily unavailable"
					message="The commentary notes for this chapter could not be loaded. Please try again shortly."
				/>
			)}

			<ExternalStudyLinks links={externalLinks} reference={reference} />

			<RelatedQuestions heading={`Questions about ${reference}`} answers={chapterAnswers} />

			{!brief && relatedTopics.length ? (
				<section className="chapter-topics">
					<h2>{t.relatedTopics}</h2>
					<ul className="topic-links">
						{relatedTopics.map((topic) => (
							<li key={topic.slug}>
								<a href={topicPath(topic.slug)}>Bible verses about {topic.title.toLowerCase()}</a>
							</li>
						))}
					</ul>
				</section>
			) : null}

			<nav className="pager">
				{hasPreviousStudy ? (
					<a href={chapterStudyPath(bookUsfm, Number(chapterId) - 1, locale)}>
						{localeChapterReference(locale, bookUsfm, Number(chapterId) - 1)}
					</a>
				) : (
					<span />
				)}
				{hasNextStudy ? (
					<a href={chapterStudyPath(bookUsfm, Number(chapterId) + 1, locale)}>
						{localeChapterReference(locale, bookUsfm, Number(chapterId) + 1)}
					</a>
				) : (
					<span />
				)}
			</nav>

			<footer className="topic-provenance">
				{reviewed ? (
					<p className="muted">
						{locale.code === 'en' ? (
							<>
								Summary, outline and questions by <a href="/about#who-runs-this">BibleHearth</a>,{' '}
								{reviewed}.
							</>
						) : (
							t.reviewedBy(reviewed)
						)}
						{commentaries.length ? ' Grounded in the commentaries above; wording is our own.' : ''}
					</p>
				) : null}
				{brief && locale.code === 'en' ? (
					<p className="muted">
						<a href="/about#editorial-process">How these studies are prepared</a>
						{' · '}
						<a href="/about#corrections">Report a correction</a>
					</p>
				) : null}
				{commentaries.length ? (
					<p className="muted">
						Commentary text belongs to the authors named beside it. Tyndale Open Study Notes are
						used under CC BY-SA 4.0; Matthew Henry and Jamieson-Fausset-Brown are public domain. See{' '}
						<a href="/attributions">attributions</a> for the full list.
					</p>
				) : null}
			</footer>
		</PageLayout>
	);
}
