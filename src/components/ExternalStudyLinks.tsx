import type { ExternalStudyLink } from '../lib/commentary/links';
type Props = {
	links: readonly ExternalStudyLink[];
	reference: string;
};

export default function ExternalStudyLinks(props: Props) {
	const { links, reference } = props;
	return (
		<>
			{links.length ? (
				<section className="external-study">
					<h2>More resources for {reference}</h2>
					<p className="muted">
						These free resources come from The Gospel Coalition and BibleProject. Their work remains
						under their own copyright, so BibleHearth links to the original pages.
					</p>
					<ul className="external-links">
						{links.map((link) => (
							<li key={link.href}>
								<a href={link.href} rel="noopener" target="_blank">
									{link.label}
								</a>
								<span className="external-publisher">{link.publisher}</span>
								<p>{link.note}</p>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</>
	);
}
