import type { APIRoute } from 'astro';
import { isNumericChapter, isNumericVerse, isSafeSlug, usfmFromBookSlug } from '../lib/bible/usfm';
import { bookPath, chapterPath, versePath, versionPath } from '../lib/bible/urls';

export const GET: APIRoute = ({ url }) => {
	const version = url.searchParams.get('version') ?? '';
	const bookSlug = url.searchParams.get('book') ?? '';
	const chapter = url.searchParams.get('chapter') ?? '';
	const verse = url.searchParams.get('verse') ?? '';

	if (!isSafeSlug(version)) {
		return Response.redirect(new URL('/versions', url.origin), 302);
	}

	if (!bookSlug) {
		return Response.redirect(new URL(versionPath(version), url.origin), 302);
	}

	if (!isSafeSlug(bookSlug)) {
		return new Response('Invalid book', { status: 400 });
	}

	const bookUsfm = usfmFromBookSlug(bookSlug);
	if (!bookUsfm) {
		return new Response('Unknown book', { status: 404 });
	}

	if (!chapter) {
		return Response.redirect(new URL(bookPath(version, bookUsfm), url.origin), 302);
	}

	if (!isNumericChapter(chapter)) {
		return new Response('Invalid chapter', { status: 400 });
	}

	if (verse) {
		if (!isNumericVerse(verse)) {
			return new Response('Invalid verse', { status: 400 });
		}
		return Response.redirect(
			new URL(versePath(version, bookUsfm, chapter, verse), url.origin),
			302,
		);
	}

	return Response.redirect(
		new URL(chapterPath(version, bookUsfm, chapter), url.origin),
		302,
	);
};
