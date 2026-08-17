import type { APIRoute } from 'astro';
import { urlsetXmlWithLastmod, xmlResponse } from '../lib/sitemap';
import { listTopics, topicPath } from '../lib/topics';

export const GET: APIRoute = async ({ site }) => {
	const topics = await listTopics();
	return xmlResponse(
		urlsetXmlWithLastmod(site, [
			{ path: '/topics' },
			...topics.map((topic) => ({
				path: topicPath(topic.id),
				lastmod: topic.data.reviewedAt,
			})),
		]),
	);
};
