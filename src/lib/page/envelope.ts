import type { FooterData } from '../../components/FooterContext';
import type { PageKind } from './routes';
export type PageEnvelope = {
	kind: PageKind;
	data: string;
	footer: FooterData;
	lang: string;
	dir: 'ltr' | 'rtl';
};
