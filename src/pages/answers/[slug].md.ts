import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import {
	answerMarkdown,
	markdownNotFound,
	markdownResponse,
} from '../../lib/markdown';

/** `/answers/nephilim-in-the-bible.md` — every reading and its objection. */
export const GET: APIRoute = async ({ params, site }) => {
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
