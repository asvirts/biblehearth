import type { APIRoute } from 'astro';
import { latestDate, urlsetXmlWithLastmod, xmlResponse } from '../lib/sitemap';
import { listTopics, topicPath } from '../lib/topics';

export const GET: APIRoute = async ({ request, site }) => {
	const topics = await listTopics();
	const reviewed = topics.map((topic) => topic.data.reviewedAt);

	return xmlResponse(
		urlsetXmlWithLastmod(site, [
			// The hub is a list of the topics, so it changed when the newest of
			// them did. Real, and the same reasoning the index applies one level up.
			{ path: '/topics', lastmod: latestDate(reviewed) },
			...topics.map((topic) => ({
				path: topicPath(topic.id),
				lastmod: topic.data.reviewedAt,
			})),
		]),
		request,
	);
};
