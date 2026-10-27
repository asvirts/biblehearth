import type { PageContext } from './types';
import type { PageKind } from './routes';
import { loadHome } from '../../loaders/editorial/Home';
import { loadStudy } from '../../loaders/editorial/Study';
import { loadTopicsIndex } from '../../loaders/editorial/TopicsIndex';
import { loadTopicDetail } from '../../loaders/editorial/TopicDetail';
import { loadAnswersIndex } from '../../loaders/editorial/AnswersIndex';
import { loadAnswerDetail } from '../../loaders/editorial/AnswerDetail';
import { loadAbout } from '../../loaders/editorial/About';
import { loadContact } from '../../loaders/editorial/Contact';
import { loadPrivacy } from '../../loaders/editorial/Privacy';
import { loadAttributions } from '../../loaders/editorial/Attributions';
import { loadStudyBook } from '../../loaders/readers/study-book';
import { loadStudyChapter } from '../../loaders/readers/study-chapter';
import { loadVersion } from '../../loaders/readers/version';
import { loadVersionBook } from '../../loaders/readers/version-book';
import { loadVersionChapter } from '../../loaders/readers/version-chapter';
import { loadVersionVerse } from '../../loaders/readers/version-verse';
import { loadVerseHub } from '../../loaders/readers/verse-hub';
import { loadVerseOfTheDay } from '../../loaders/readers/verse-of-the-day';
import { loadVersions } from '../../loaders/readers/versions';
import { loadNotFound } from '../../loaders/readers/not-found';
export const loaders: Record<PageKind, (context: PageContext) => Promise<unknown>> = {
	Home: loadHome,
	Study: loadStudy,
	TopicsIndex: loadTopicsIndex,
	TopicDetail: loadTopicDetail,
	AnswersIndex: loadAnswersIndex,
	AnswerDetail: loadAnswerDetail,
	About: loadAbout,
	Contact: loadContact,
	Privacy: loadPrivacy,
	Attributions: loadAttributions,
	StudyBook: loadStudyBook,
	StudyChapter: loadStudyChapter,
	Version: loadVersion,
	VersionBook: loadVersionBook,
	VersionChapter: loadVersionChapter,
	VersionVerse: loadVersionVerse,
	VerseHub: loadVerseHub,
	VerseOfTheDay: loadVerseOfTheDay,
	Versions: loadVersions,
	NotFound: loadNotFound,
};
