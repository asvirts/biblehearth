import { splitLocalePath } from '../i18n/locales';
import { RouteControl } from './navigation';

export const PAGE_KINDS = [
	'Home',
	'Study',
	'TopicsIndex',
	'TopicDetail',
	'AnswersIndex',
	'AnswerDetail',
	'About',
	'Contact',
	'Privacy',
	'Attributions',
	'StudyBook',
	'StudyChapter',
	'Version',
	'VersionBook',
	'VersionChapter',
	'VersionVerse',
	'VerseHub',
	'VerseOfTheDay',
	'Versions',
	'NotFound',
] as const;
export type PageKind = (typeof PAGE_KINDS)[number];
export type PageMatch = { kind: PageKind; params: Record<string, string> };
const hubs: Record<string, PageKind> = {
	'/': 'Home',
	'/study': 'Study',
	'/topics': 'TopicsIndex',
	'/answers': 'AnswersIndex',
	'/about': 'About',
	'/contact': 'Contact',
	'/privacy': 'Privacy',
	'/attributions': 'Attributions',
	'/versions': 'Versions',
	'/verse-of-the-day': 'VerseOfTheDay',
};

export function matchPage(pathname: string): PageMatch {
	const { locale, rest } = splitLocalePath(pathname);
	if (rest === '/commentary' || rest.startsWith('/commentary/')) {
		const old = rest.slice('/commentary'.length);
		if (old.split('/').filter(Boolean).length <= 2)
			throw new RouteControl(301, `${locale.prefix ? `/${locale.prefix}` : ''}${old || '/study'}`);
	}
	if (hubs[rest]) return { kind: hubs[rest], params: {} };
	let parts: string[];
	try {
		parts = rest
			.split('/')
			.filter(Boolean)
			.map((part) => decodeURIComponent(part));
	} catch {
		return { kind: 'NotFound', params: {} };
	}
	if (parts.some((part) => part.includes('/') || part.includes('\\') || part.includes('\0')))
		return { kind: 'NotFound', params: {} };
	if (parts[0] === 'topics' && parts.length === 2)
		return { kind: 'TopicDetail', params: { slug: parts[1]! } };
	if (parts[0] === 'answers' && parts.length === 2)
		return { kind: 'AnswerDetail', params: { slug: parts[1]! } };
	if (parts[0] === 'bible' && parts.length >= 2 && parts.length <= 5) {
		const [, version, book, chapter, verse] = parts;
		return {
			kind: (['Version', 'VersionBook', 'VersionChapter', 'VersionVerse'] as const)[
				parts.length - 2
			]!,
			params: Object.fromEntries(
				Object.entries({ version, book, chapter, verse }).filter(
					(entry): entry is [string, string] => entry[1] !== undefined,
				),
			),
		};
	}
	if (parts[0] === 'verse' && parts.length === 4)
		return { kind: 'VerseHub', params: { book: parts[1]!, chapter: parts[2]!, verse: parts[3]! } };
	if (parts.length === 1) return { kind: 'StudyBook', params: { book: parts[0]! } };
	if (parts.length === 2)
		return { kind: 'StudyChapter', params: { book: parts[0]!, chapter: parts[1]! } };
	return { kind: 'NotFound', params: {} };
}
