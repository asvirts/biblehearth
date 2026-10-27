import type { ReactElement } from 'react';
import PageLayout from '../../components/PageLayout';
import Figure from '../../components/Figure';
import { answerPath } from '../../lib/paths';
import { formatReference } from '../../lib/bible/refs';
import { truncateWords } from '../../lib/bible/text';
import { absoluteUrl } from '../../lib/bible/urls';
import { breadcrumbJsonLd, itemListJsonLd } from '../../lib/seo';
import type { loadAnswersIndex } from '../../loaders/editorial/AnswersIndex';

export function AnswersIndex(data: Awaited<ReturnType<typeof loadAnswersIndex>>): ReactElement {
	const { site, answers, labels, figure, share } = data;
	const context = { site: new URL(site) };
	return (
		<PageLayout
			title="Bible Questions Answered | Difficult Passages Explained"
			description={truncateWords(
				`Explore difficult Bible questions with the passage in context, the main interpretations, and the evidence behind each one: ${labels.join(', ')}.`,
				155,
			)}
			canonicalPath="/answers"
			image={share?.image}
			imageAlt={share?.imageAlt}
			jsonLd={[
				breadcrumbJsonLd(context.site, [
					{ name: 'BibleHearth', path: '/' },
					{ name: 'Answers', path: '/answers' },
				]),
				itemListJsonLd({
					name: 'Bible questions answered',
					items: answers.map((answer) => ({
						name: answer.question,
						url: absoluteUrl(context.site, answerPath(answer.id)),
					})),
				}),
			]}
		>
			<nav className="crumbs" aria-label="Breadcrumb">
				<a href="/">Home</a>
				<span>/</span>
				<span>Answers</span>
			</nav>

			<h1>Answers to Difficult Bible Questions</h1>
			<p className="lede">
				Each page starts with one question and the passage behind it. Then it walks through the main
				interpretations, the evidence for each one, and the hardest questions each view must answer.
				Some passages leave room for uncertainty, and the explanations keep that uncertainty in
				view.
			</p>

			{figure ? <Figure figure={figure} /> : null}

			<div className="stack">
				{answers.map((answer) => (
					<article className="panel" key={answer.id}>
						<h2>
							<a href={answerPath(answer.id)}>{answer.question}</a>
						</h2>
						{/* A direct answer makes this hub itself answerable. */}
						<p>{answer.shortAnswer}</p>
						<p className="muted">
							{formatReference(answer.passage)} · {answer.viewCount} readings compared
							{answer.faqCount ? ` · ${answer.faqCount} related questions` : ''}
						</p>
					</article>
				))}
			</div>
		</PageLayout>
	);
}
