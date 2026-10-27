import type { ChapterCommentary } from '../lib/commentary/api';
import { attributionLine } from '../lib/commentary/sources';
import { bookSlugFromUsfm } from '../lib/bible/usfm';
type Props = {
	entry: ChapterCommentary;
	bookUsfm: string;
	chapterId: string;
	/** Human reference for headings: "Genesis 1". */
	reference: string;
	/**
	 * Whether the notes start expanded. Tyndale does; the 1706 and 1871 sources
	 * do not. Three full commentaries opened at once is a wall of text that
	 * teaches a new reader to scroll past all of it, and the two older voices are
	 * the ones that punish an unprepared reader hardest. Collapsed is still
	 * indexed — the markup is in the page either way — so nothing is traded away
	 * for the calmer first impression.
	 */
	expanded?: boolean;
};

export default function CommentarySourceBlock(props: Props) {
	const { entry, bookUsfm, chapterId, reference, expanded = false } = props;
	const { source, introduction, notes } = entry;
	const bookSlug = bookSlugFromUsfm(bookUsfm);
	const noteCount = notes.length;
	return (
		<>
			<section className="commentary-source" id={`notes-${source.id}`}>
				<h2>
					{source.name} on {reference}
				</h2>
				<p className="source-byline">{source.byline}</p>
				<p className="source-about">{source.about}</p>

				{source.readingNote ? (
					<p className="source-reading-note">
						<strong>Before you start:</strong> {source.readingNote}
					</p>
				) : null}

				<details className="commentary-body" open={expanded}>
					<summary>
						{noteCount
							? `${introduction ? 'Chapter overview and ' : ''}${noteCount} ${noteCount === 1 ? 'note' : 'notes'} on ${reference}`
							: `Chapter overview of ${reference}`}
					</summary>

					{introduction ? (
						<div className="commentary-intro">
							<h3>What this chapter is doing</h3>
							{introduction.map((paragraph, i) => (
								<p key={i} dangerouslySetInnerHTML={{ __html: paragraph }} />
							))}
						</div>
					) : null}

					{notes.map((note, i) => (
						<div key={i} className="commentary-note">
							<h3>
								{note.verse > 0 ? (
									<a href={`/verse/${bookSlug}/${chapterId}/${note.verse}`}>Verse {note.verse}</a>
								) : (
									'On this chapter'
								)}
							</h3>
							{note.paragraphs.map((paragraph, i) => (
								<p key={i} dangerouslySetInnerHTML={{ __html: paragraph }} />
							))}
						</div>
					))}
				</details>

				{/* Attribution sits with the text it covers, not on a credits page a reader
	    would have to go looking for. For Tyndale this is a licence obligation;
	    for the public-domain sources it is simply how you tell a reader they are
	    reading a voice from 1706 rather than ours. */}
				<p className="commentary-attribution">
					{attributionLine(source)}{' '}
					<a href={source.license.url} rel="license nofollow noopener" target="_blank">
						{source.license.name}
					</a>
					{' · '}
					<a href={source.homepage} rel="nofollow noopener" target="_blank">
						Read the original
					</a>
				</p>
			</section>
		</>
	);
}
