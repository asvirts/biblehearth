import type { EditorialFigure } from './types';
import home from '../../assets/editorial/hubs/home.jpg';
import about from '../../assets/editorial/hubs/about.jpg';
import study from '../../assets/editorial/hubs/study.jpg';
import topics from '../../assets/editorial/hubs/topics.jpg';
import answers from '../../assets/editorial/hubs/answers.jpg';

export const HUB_PAGES = {
	home: { path: '/', name: 'Home' },
	about: { path: '/about', name: 'About' },
	study: { path: '/study', name: 'Bible study' },
	topics: { path: '/topics', name: 'Topics' },
	answers: { path: '/answers', name: 'Answers' },
} as const;

export type HubId = keyof typeof HUB_PAGES;

export const hubFigures = {
	home: {
		src: home,
		alt: 'Logs burning in an open brick hearth, the fire lighting the grate from within.',
		caption:
			'A hearth is the oldest picture of a house that is warm enough to sit still in — which is the kind of reading this site is for.',
		kind: 'photograph',
		credit: {
			title: 'Open fire in a hearth grate',
			creator: 'Simon Carey',
			holder: 'Wikimedia Commons',
			license: 'cc-by-sa',
			licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
			sourceUrl:
				'https://commons.wikimedia.org/wiki/File:Open%20fire%20in%20hearth%20grate%20at%20The%20Black%20Horse%20Inn,%20Nuthurst,%20West%20Sussex.jpg',
		},
	},
	about: {
		src: about,
		alt: 'A sheet of the Codex Sinaiticus, four columns of Greek uncial script on parchment.',
		caption:
			'The writing on this site is new. The text it is about is not: a fourth-century copy of the Greek Bible, still readable.',
		kind: 'photograph',
		credit: {
			title: 'Codex Sinaiticus',
			creator: 'Unknown scribes',
			date: 'c. 330–360',
			holder: 'British Library',
			license: 'cc0',
			licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
			sourceUrl: 'https://commons.wikimedia.org/wiki/File:Codex%20Sinaiticus.jpg',
		},
	},
	study: {
		src: study,
		alt: 'The Long Room of Trinity College Dublin, a barrel-vaulted gallery of old books in two storeys.',
		caption:
			'A room built to keep books in reach of anyone who walks in — the same job a chapter study page is trying to do.',
		kind: 'photograph',
		credit: {
			title: 'The Long Room, Trinity College Dublin',
			creator: 'David Iliff',
			holder: 'Wikimedia Commons',
			license: 'cc-by-sa',
			licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
			sourceUrl:
				'https://commons.wikimedia.org/wiki/File:Long%20Room%20Interior,%20Trinity%20College%20Dublin,%20Ireland%20-%20Diliff.jpg',
		},
	},
	topics: {
		src: topics,
		alt: 'An open spread of a Gutenberg Bible, blackletter columns on cream paper in a library case.',
		caption:
			'Topics on this site are not a verse index. They are an argument, the way a printed Bible is an argument bound in order.',
		kind: 'photograph',
		credit: {
			title: 'Gutenberg Bible, Lenox Copy',
			creator: 'Johannes Gutenberg',
			date: 'c. 1455',
			holder: 'New York Public Library',
			license: 'cc-by-sa',
			licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
			sourceUrl:
				'https://commons.wikimedia.org/wiki/File:Gutenberg%20Bible,%20Lenox%20Copy,%20New%20York%20Public%20Library,%202009.%20Pic%2001.jpg',
		},
	},
	answers: {
		src: answers,
		alt: 'A medieval manuscript of Paul with the biblical text in a centre column and commentary packed into the margins.',
		caption:
			'Hard questions have always been answered in the margins of the passage, not instead of it.',
		kind: 'photograph',
		credit: {
			title: 'Pauline epistles with the Glossa ordinaria',
			creator: 'Unknown scribes',
			date: '12th century',
			holder: 'Bibliothèque nationale de France',
			license: 'pd',
			licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
			sourceUrl:
				'https://commons.wikimedia.org/wiki/File:Epistolae%20Pauli%20cum%20glossa%20ordinaria.%20-%20btv1b8426047w%20(226%20of%20395).jpg',
		},
	},
} as const satisfies Record<HubId, EditorialFigure>;
