import type { BibleVersion } from '@youversion/platform-core';
type Props = {
	version: Pick<BibleVersion, 'copyright' | 'info' | 'publisher_url' | 'title'>;
};

export default function CopyrightNotice(props: Props) {
	const { version } = props;
	const notice =
		version.copyright ||
		version.info ||
		`${version.title} copyright information is provided by the publisher.`;
	return (
		<>
			<footer className="copyright">
				<p>{notice}</p>
				{version.publisher_url ? (
					<p>
						<a href={version.publisher_url} rel="noopener noreferrer">
							Publisher information
						</a>
					</p>
				) : null}
			</footer>
		</>
	);
}
