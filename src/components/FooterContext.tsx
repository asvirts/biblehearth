import { createContext, useContext } from 'react';

/** Small, public navigation data prepared once by the server for every page. */
export type FooterData = {
	topics: { id: string; data: { title: string } }[];
	answers: { id: string; data: { label: string } }[];
	verification?: { google?: string; bing?: string };
};

export const FooterDataContext = createContext<FooterData>({ topics: [], answers: [] });
export function useFooterData(): FooterData {
	return useContext(FooterDataContext);
}
