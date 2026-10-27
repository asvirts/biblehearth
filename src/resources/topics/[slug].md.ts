import type { ResourceHandler } from '../../lib/page/types';
import { getEntry } from '../../lib/content';
import { markdownNotFound, markdownResponse, topicMarkdown } from '../../lib/markdown';

/** `/topics/anxiety.md` — the verse selection and its explanations, ours alone. */
export const GET: ResourceHandler = async ({ params, site }) => {
	const slug = params.slug;
	if (!slug) {
		return markdownNotFound();
	}

	const topic = await getEntry('topics', slug);
	if (!topic || topic.data.draft) {
		return markdownNotFound();
	}

	return markdownResponse(await topicMarkdown(topic, site));
};
