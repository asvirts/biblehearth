import type { BiblePassage, BibleVersion } from '@youversion/platform-core';
import {
	NOTFOUND_CACHE_CONTROL,
	PARTIAL_READER_CACHE_CONTROL,
	READER_CACHE_CONTROL,
	setCacheControl,
	setPageHeaders,
} from '../http.ts';
import { HUB_TRANSLATION_LIMIT, HUB_TRANSLATION_SLUGS } from './translations.ts';

/** The existing cached Scripture reads in production; controlled reads in tests. */
export type VerseHubSource = {
	listVersions(): Promise<BibleVersion[]>;
	versionSlug(version: BibleVersion, catalog: BibleVersion[]): string;
	/** Fetch publisher metadata for a chosen edition before displaying its text. */
	getVersionDetails?(version: BibleVersion): Promise<BibleVersion | null>;
	getVerseHtml(
		versionId: number,
		bookUsfm: string,
		chapterId: string,
		verseId: string,
	): Promise<BiblePassage | null>;
	errorStatus(error: unknown): number;
};

export type VerseHubRendering = {
	version: BibleVersion;
	slug: string;
	passage: BiblePassage;
};

type FailureStatus = 404 | 500 | 503;
type ReadResult =
	{ rendering: VerseHubRendering; status: 200 } | { rendering: null; status: FailureStatus };

export type VerseHubResult = {
	renderings: VerseHubRendering[];
	status: 200 | FailureStatus;
	headers: Headers;
};

function result(
	status: VerseHubResult['status'],
	renderings: VerseHubRendering[] = [],
	partial = false,
): VerseHubResult {
	const headers = new Headers();
	if (status === 404) {
		setCacheControl({ headers }, NOTFOUND_CACHE_CONTROL);
	} else {
		setPageHeaders(
			{ headers },
			status,
			partial ? PARTIAL_READER_CACHE_CONTROL : READER_CACHE_CONTROL,
		);
	}
	return { renderings, status, headers };
}

/**
 * Select and load a verse hub without losing the reason a rendering is absent.
 *
 * A missing rendering establishes absence only in that translation. An
 * unavailable one establishes nothing: if none succeed, invite a retry rather
 * than cache a false 404. When some succeed, keep them in curated order and
 * shorten the page cache only if another read failed temporarily or unexpectedly.
 */
export function createVerseHub(source: VerseHubSource) {
	function failureStatus(error: unknown): FailureStatus {
		const status = source.errorStatus(error);
		return status === 404 || status === 503 ? status : 500;
	}

	return async function loadVerseHub(
		bookUsfm: string,
		chapterId: string,
		verseId: string,
	): Promise<VerseHubResult> {
		try {
			const catalog = await source.listVersions();
			const chosen = HUB_TRANSLATION_SLUGS.flatMap((slug) => {
				const version = catalog.find((item) => source.versionSlug(item, catalog) === slug);
				return version ? [{ version, slug }] : [];
			}).slice(0, HUB_TRANSLATION_LIMIT);

			// A catalogue with no selected editions says nothing about this verse.
			if (chosen.length === 0) {
				return result(503);
			}

			const loaded = await Promise.all(
				chosen.map(async ({ version, slug }): Promise<ReadResult> => {
					let detailedVersion = version;
					if (source.getVersionDetails) {
						try {
							const detail = await source.getVersionDetails(version);
							if (!detail) return { rendering: null, status: 503 };
							detailedVersion = detail;
						} catch (error) {
							const status = failureStatus(error);
							// Missing metadata is not a missing verse.
							return { rendering: null, status: status === 404 ? 503 : status };
						}
					}
					try {
						// getVerseHtml reuses the same chapter entry as readers and the
						// warmer, including the fallback for merged verse markers.
						const passage = await source.getVerseHtml(version.id, bookUsfm, chapterId, verseId);
						return passage
							? { rendering: { version: detailedVersion, slug, passage }, status: 200 }
							: { rendering: null, status: 404 };
					} catch (error) {
						return { rendering: null, status: failureStatus(error) };
					}
				}),
			);

			const renderings = loaded.flatMap(({ rendering }) => (rendering ? [rendering] : []));
			const unexpected = loaded.some(({ status }) => status === 500);
			const unavailable = loaded.some(({ status }) => status === 503);

			if (renderings.length > 0) {
				return result(200, renderings, unexpected || unavailable);
			}
			return result(unexpected ? 500 : unavailable ? 503 : 404);
		} catch (error) {
			const status = failureStatus(error);
			// A missing catalogue cannot establish a missing verse either.
			return result(status === 404 ? 503 : status);
		}
	};
}
