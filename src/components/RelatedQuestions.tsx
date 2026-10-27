import type { AnswerRef } from '../lib/answers';
type Props = {
	heading: string;
	answers: readonly AnswerRef[];
};

export default function RelatedQuestions(props: Props) {
	const { heading, answers } = props;
	return (
		<>
			{answers.length ? (
				<section className="chapter-topics">
					<h2>{heading}</h2>
					<ul className="topic-links">
						{answers.map((answer) => (
							<li key={answer.slug}>
								<a href={`/answers/${answer.slug}`}>{answer.question}</a>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</>
	);
}
