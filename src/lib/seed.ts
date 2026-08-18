import { answerRefs, listAnswers } from './answers';
import { expandUsfm } from './bible/refs';
import { bookSlugFromUsfm, isKnownBookId } from './bible/usfm';
import { listTopics, topicVerses } from './topics';
import { getVerseOfTheDayCalendar } from './youversion/api';

/**
 * The verse hubs we ask Google to index.
 *
 * The route serves any valid reference, but only this seed set goes in a
 * sitemap. Submitting all ~31,000 verse hubs from a domain with no authority
 * would spend the entire crawl budget on pages that cannot yet rank, and would
 * present the site as mostly thin. Expand once these are actually indexed.
 *
 * Three sources, all meaningful rather than arbitrary:
 *  - the YouVersion Verse of the Day calendar (366 curated references)
 *  - every verse cited by a topic page
 *  - every verse cited by an answer page
 *
 * The editorial sources matter most: those hubs link back to the page that
 * cites them, so each one arrives with an internal link already pointing at it.
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

	for (const answer of await listAnswers()) {
		for (const usfm of answerRefs(answer)) {
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
