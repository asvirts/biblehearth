import { createVerseHub } from '../bible/verse-hub';
import {
	chapterExists,
	errorStatus,
	findBook,
	getBibleIndex,
	getVerseHtml,
	hydrateVersion,
	listVersions,
	versionSlug,
} from './api';

/** Keep Framework configuration and cached upstream reads out of the test seam. */
export const loadVerseHub = createVerseHub({
	listVersions,
	versionSlug,
	getVersionDetails: hydrateVersion,
	async hasChapter(versionId, bookUsfm, chapterId) {
		const book = findBook(await getBibleIndex(versionId), bookUsfm);
		return Boolean(book && chapterExists(book, chapterId));
	},
	getVerseHtml,
	errorStatus,
});
