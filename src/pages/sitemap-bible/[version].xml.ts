import type { APIRoute } from 'astro';
import { isNumericChapter } from '../../lib/bible/usfm';
import { bookPath, chapterPath, versionPath } from '../../lib/bible/urls';
import { urlsetXml, xmlResponse } from '../../lib/sitemap';
import {
	getBibleIndex,
	resolveVersion,
} from '../../lib/youversion/api';

export const GET: APIRoute = async ({ params, site }) => {
	const slug = params.version;
	if (!slug) {
		return new Response('Not found', { status: 404 });
	}

	try {
		const resolved = await resolveVersion(slug);
		if (!resolved) {
			return new Response('Not found', { status: 404 });
		}

		const index = await getBibleIndex(resolved.version.id);
		const paths = [versionPath(resolved.slug)];

		for (const book of index.books) {
			paths.push(bookPath(resolved.slug, book.id));
			for (const chapter of book.chapters) {
				if (isNumericChapter(chapter.id)) {
					paths.push(chapterPath(resolved.slug, book.id, chapter.id));
				}
			}
		}

		return xmlResponse(urlsetXml(site, paths));
	} catch {
		return new Response('Sitemap unavailable', { status: 503 });
	}
};
