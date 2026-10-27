import { licenseDisplayName, type EditorialFigure } from '../lib/images/types';

type Props = { figure: EditorialFigure };

/** Keep the credit next to the work it covers, including on small screens. */
export default function Figure({ figure }: Props) {
	const { credit, src } = figure;
	return (
		<figure className="editorial-figure">
			<img
				src={src.src}
				width={src.width}
				height={src.height}
				alt={figure.alt}
				sizes="(max-width: 42rem) calc(100vw - 2.3rem), 42rem"
			/>
			<figcaption>
				<span className="figure-caption">{figure.caption}</span>
				<span className="figure-credit">
					<a href={credit.sourceUrl} rel="noopener noreferrer">
						{credit.title}
					</a>
					{credit.date ? ` (${credit.date})` : ''}, {credit.creator}. {credit.holder}.{' '}
					<a href={credit.licenseUrl} rel="license noopener noreferrer">
						{licenseDisplayName(credit.license, credit.licenseUrl)}
					</a>
					.
				</span>
			</figcaption>
		</figure>
	);
}
