type Props = {
	title: string;
	message: string;
	/**
	 * Whether this message *is* the page, or sits beside it.
	 *
	 * `page` is the original behaviour and stays the default: the message replaces
	 * the content entirely, so its title is the page's only heading and a link
	 * home is the only thing left to offer. The 404 and a reader page whose
	 * passage is the whole point both work that way.
	 *
	 * `notice` is for a page that rendered fine without the part that failed. The
	 * topic and answer pages now return 200 in that case (see
	 * DEGRADED_CACHE_CONTROL), which makes the heading level a correctness
	 * question rather than a styling one: an `h1` here gave those pages two of
	 * them, competing to say what the page is about, on a response a crawler is
	 * expected to index. It also drops the link home, which would be advice to
	 * leave an article the reader can still read.
	 */
	variant?: 'page' | 'notice';
};

export default function StatusMessage(props: Props) {
	const { title, message, variant = 'page' } = props;
	return (
		<>
			{variant === 'page' ? (
				<>
					<h1>{title}</h1>
					<p className="lede">{message}</p>
					<p>
						<a href="/">Back to BibleHearth</a>
					</p>
				</>
			) : (
				/* `role="status"` so a screen reader is told what is missing without the
		   interruption an alert would make of it. */
				<aside className="panel" role="status">
					<h2>{title}</h2>
					<p>{message}</p>
				</aside>
			)}
		</>
	);
}
