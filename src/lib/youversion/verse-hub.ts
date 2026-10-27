import { createVerseHub } from '../bible/verse-hub';
import { errorStatus, getVerseHtml, hydrateVersion, listVersions, versionSlug } from './api';

/** Keep Framework configuration and cached upstream reads out of the test seam. */
export const loadVerseHub = createVerseHub({
	listVersions,
	versionSlug,
	getVersionDetails: hydrateVersion,
	getVerseHtml,
	errorStatus,
});
