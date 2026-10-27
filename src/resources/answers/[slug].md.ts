import type { ResourceHandler } from '../../lib/page/types';
import { getEntry } from '../../lib/content';
import { answerMarkdown, markdownNotFound, markdownResponse } from '../../lib/markdown';

/** `/answers/nephilim-in-the-bible.md` — every reading and its objection. */
export const GET: ResourceHandler = async ({ params, site }) => {
	const slug = params.slug;
	if (!slug) {
		return markdownNotFound();
	}

	const answer = await getEntry('answers', slug);
	if (!answer || answer.data.draft) {
		return markdownNotFound();
	}

	return markdownResponse(await answerMarkdown(answer, site));
};
