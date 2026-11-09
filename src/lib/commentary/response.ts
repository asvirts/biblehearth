/** The commentary API is independent of the licensed Scripture provider. */
export const MAX_COMMENTARY_RESPONSE_BYTES = 4 * 1024 * 1024;

// Generous for a chapter and its book introduction, but bounded before the
// text is split into paragraphs and turned into HTML. Psalm 119 has 176 verses.
const MAX_CHAPTER_ITEMS = 4096;
const MAX_CONTENT_PARTS = 16_384;
const MAX_PARAGRAPHS = 8192;

type ApiVerseItem = {
	type?: string;
	number?: number | string;
	content?: unknown[] | null;
};

export type ApiChapterResponse = {
	book?: { introduction?: string | null } | null;
	chapter?: {
		number?: number | string;
		introduction?: string | null;
		content?: ApiVerseItem[] | null;
	} | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reject bad upstream shapes rather than caching them as missing commentary. */
function validateResponse(value: unknown): ApiChapterResponse {
	if (!isRecord(value)) throw new Error('Invalid commentary response');
	if (value.book == null && value.chapter == null) throw new Error('Empty commentary response');

	let paragraphs = 0;
	let parts = 0;
	const checkText = (text: unknown) => {
		if (text === null || text === undefined) return;
		if (typeof text !== 'string') throw new Error('Invalid commentary text');
		// commentaryParagraphs splits on runs of newlines. Count those runs
		// without allocating an intermediate array for an untrusted response.
		paragraphs += 1;
		if (paragraphs > MAX_PARAGRAPHS) throw new Error('Commentary has too many paragraphs');
		let inNewline = false;
		for (let i = 0; i < text.length; i += 1) {
			const newline = text.charCodeAt(i) === 10;
			if (newline && !inNewline) paragraphs += 1;
			if (paragraphs > MAX_PARAGRAPHS) throw new Error('Commentary has too many paragraphs');
			inNewline = newline;
		}
	};

	if (value.book !== undefined && value.book !== null) {
		if (!isRecord(value.book)) throw new Error('Invalid commentary book');
		checkText(value.book.introduction);
	}
	if (value.chapter !== undefined && value.chapter !== null) {
		if (!isRecord(value.chapter)) throw new Error('Invalid commentary chapter');
		checkText(value.chapter.introduction);
		const items = value.chapter.content;
		if (items !== undefined && items !== null) {
			if (!Array.isArray(items) || items.length > MAX_CHAPTER_ITEMS) {
				throw new Error('Invalid commentary chapter content');
			}
			for (const item of items) {
				if (!isRecord(item)) throw new Error('Invalid commentary item');
				if (item.type !== 'verse' || item.content == null) continue;
				if (!Array.isArray(item.content)) throw new Error('Invalid commentary verse content');
				parts += item.content.length;
				if (parts > MAX_CONTENT_PARTS) throw new Error('Commentary has too many content parts');
				for (const part of item.content) {
					// The API may include structural objects alongside plain text.
					// They are ignored by the renderer, as before.
					if (typeof part === 'string') checkText(part);
				}
			}
		}
	}
	return value as ApiChapterResponse;
}

/**
 * Read the decoded response stream under a byte ceiling, regardless of whether
 * Content-Length is missing or misleading. A rejected body is cancelled, and
 * callers can use the existing stale-cache or optional-commentary fallback.
 */
export async function readCommentaryResponse(response: Response): Promise<ApiChapterResponse> {
	if (!response.body) throw new Error('Empty commentary response');
	const reader = response.body.getReader();
	let buffer = new Uint8Array(16 * 1024);
	let used = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			const next = used + value.byteLength;
			if (next > MAX_COMMENTARY_RESPONSE_BYTES) throw new Error('Commentary response too large');
			if (next > buffer.byteLength) {
				const grown = new Uint8Array(
					Math.min(MAX_COMMENTARY_RESPONSE_BYTES, Math.max(next, buffer.byteLength * 2)),
				);
				grown.set(buffer.subarray(0, used));
				buffer = grown;
			}
			buffer.set(value, used);
			used = next;
		}
	} catch (error) {
		// Do not let a non-cooperative upstream cancel delay the fallback.
		void reader.cancel().catch(() => {});
		throw error;
	} finally {
		reader.releaseLock();
	}

	const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, used));
	return validateResponse(JSON.parse(text) as unknown);
}
