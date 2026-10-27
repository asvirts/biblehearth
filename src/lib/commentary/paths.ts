import { bookSlug } from '../bible/books';
import { displayChapterNumber } from '../bible/psalms';
import { DEFAULT_LOCALE, localePath, type Locale } from '../i18n/locales';
export const STUDY_HUB_PATH = '/study';
export function studyHubPath(locale: Locale = DEFAULT_LOCALE): string {
	return localePath(locale, STUDY_HUB_PATH);
}
export function bookStudyPath(bookUsfm: string, locale: Locale = DEFAULT_LOCALE): string {
	return localePath(locale, `/${bookSlug(locale, bookUsfm)}`);
}
export function chapterStudyPath(
	bookUsfm: string,
	chapter: string | number,
	locale: Locale = DEFAULT_LOCALE,
): string {
	return `${bookStudyPath(bookUsfm, locale)}/${displayChapterNumber(locale, bookUsfm, chapter)}`;
}
