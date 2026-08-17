import { bookSlugFromUsfm, isKnownBookId } from '../bible/usfm';
import { getVerseOfTheDayCalendar } from '../youversion/api';
import { expandUsfm, listTopics, topicVerses } from './index';

/**
 * The verse hubs we ask Google to index.
 *
 * The route serves any valid reference, but only this seed set goes in a
 * sitemap. Submitting all ~31,000 verse hubs from a domain with no authority
 * would spend the entire crawl budget on pages that cannot yet rank, and would
 * present the site as mostly thin. Expand once these are actually indexed.
 *
 * Two sources, both meaningful rather than arbitrary:
 *  - the YouVersion Verse of the Day calendar (366 curated references)
 *  - every verse cited by a topic page, so the two systems reinforce each other
 */
export async function verseHubSeedPaths(): Promise<string[]> {
	const refs = new Set<string>();

	const calendar = await getVerseOfTheDayCalendar();
	for (const entry of calendar) {
		for (const single of expandUsfm(entry.passage_id)) {
			refs.add(single);
		}
	}

	for (const topic of await listTopics()) {
		for (const { usfm } of topicVerses(topic)) {
			for (const single of expandUsfm(usfm)) {
				refs.add(single);
			}
		}
	}

	const paths: string[] = [];
	for (const ref of refs) {
		const [book, chapter, verse] = ref.split('.');
		if (!book || !chapter || !verse || !isKnownBookId(book)) {
			continue;
		}
		if (!/^\d+$/.test(chapter) || !/^\d+$/.test(verse)) {
			continue;
		}
		paths.push(`/verse/${bookSlugFromUsfm(book)}/${chapter}/${verse}`);
	}

	return paths.sort();
}
