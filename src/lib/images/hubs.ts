import type { EditorialFigure } from './types';

export const HUB_PAGES = {
	home: { path: '/', name: 'Home' },
	about: { path: '/about', name: 'About' },
	study: { path: '/study', name: 'Bible study' },
	topics: { path: '/topics', name: 'Topics' },
	answers: { path: '/answers', name: 'Answers' },
} as const;

export type HubId = keyof typeof HUB_PAGES;

/**
 * Optional pictures for the five hub pages.
 *
 * Empty on purpose: the stock set was taken down so the pages can be
 * hand-illustrated later. Rendering and Open Graph both no-op when a hub
 * has no entry here.
 */
export const hubFigures: Partial<Record<HubId, EditorialFigure>> = {};
