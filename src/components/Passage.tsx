type Props = {
	html: string;
};

export default function Passage(props: Props) {
	const { html } = props;
	return (
		<>
			<div className="scripture" dangerouslySetInnerHTML={{ __html: html }} />
		</>
	);
}
