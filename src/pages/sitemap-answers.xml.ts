import type { APIRoute } from 'astro';
import { answerPath, listAnswers } from '../lib/answers';
import { latestDate, urlsetXmlWithLastmod, xmlResponse } from '../lib/sitemap';

export const GET: APIRoute = async ({ site, request }) => {
	const answers = await listAnswers();
	const reviewed = answers.map((answer) => answer.data.reviewedAt);

	return xmlResponse(
		urlsetXmlWithLastmod(site, [
			// The hub is a list of the answers, so it changed when the newest of
			// them did.
			{ path: '/answers', lastmod: latestDate(reviewed) },
			...answers.map((answer) => ({
				path: answerPath(answer.id),
				lastmod: answer.data.reviewedAt,
			})),
		]),
		request,
	);
};
