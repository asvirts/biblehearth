import type { ReactElement } from 'react';
import type { PageKind } from './routes';
import { Home } from '../../views/editorial/Home';
import { Study } from '../../views/editorial/Study';
import { TopicsIndex } from '../../views/editorial/TopicsIndex';
import { TopicDetail } from '../../views/editorial/TopicDetail';
import { AnswersIndex } from '../../views/editorial/AnswersIndex';
import { AnswerDetail } from '../../views/editorial/AnswerDetail';
import { About } from '../../views/editorial/About';
import { Contact } from '../../views/editorial/Contact';
import { Privacy } from '../../views/editorial/Privacy';
import { Attributions } from '../../views/editorial/Attributions';
import { renderStudyBook } from '../../views/readers/study-book';
import { renderStudyChapter } from '../../views/readers/study-chapter';
import { renderVersion } from '../../views/readers/version';
import { renderVersionBook } from '../../views/readers/version-book';
import { renderVersionChapter } from '../../views/readers/version-chapter';
import { renderVersionVerse } from '../../views/readers/version-verse';
import { renderVerseHub } from '../../views/readers/verse-hub';
import { renderVerseOfTheDay } from '../../views/readers/verse-of-the-day';
import { renderVersions } from '../../views/readers/versions';
import { renderNotFound } from '../../views/readers/not-found';
export const views: Record<PageKind, (model: never) => ReactElement> = {
	Home,
	Study,
	TopicsIndex,
	TopicDetail,
	AnswersIndex,
	AnswerDetail,
	About,
	Contact,
	Privacy,
	Attributions,
	StudyBook: renderStudyBook,
	StudyChapter: renderStudyChapter,
	Version: renderVersion,
	VersionBook: renderVersionBook,
	VersionChapter: renderVersionChapter,
	VersionVerse: renderVersionVerse,
	VerseHub: renderVerseHub,
	VerseOfTheDay: renderVerseOfTheDay,
	Versions: renderVersions,
	NotFound: renderNotFound,
};
