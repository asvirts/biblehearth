import type { APIRoute } from 'astro';
import { answerPath, listAnswers } from '../lib/answers';
import { urlsetXmlWithLastmod, xmlResponse } from '../lib/sitemap';

export const GET: APIRoute = async ({ site }) => {
	const answers = await listAnswers();
	return xmlResponse(
		urlsetXmlWithLastmod(site, [
			{ path: '/answers' },
			...answers.map((answer) => ({
				path: answerPath(answer.id),
				lastmod: answer.data.reviewedAt,
			})),
		]),
	);
};
