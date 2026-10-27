import type { ReactNode } from 'react';
import type { Locale } from '../i18n/locales';

export type PageContext = {
	params: Record<string, string | undefined>;
	url: URL;
	site: URL;
	locals: { locale: Locale; localePath: string };
	request: Request;
	response: { status: number; headers: Headers };
	redirect: (path: string, status?: number) => never;
	notFound: () => never;
};
export type PageProps = {
	title: string;
	description: string;
	canonicalPath?: string;
	noindex?: boolean;
	lang?: string;
	dir?: 'ltr' | 'rtl';
	alternates?: { hreflang: string; href: string }[];
	markdown?: boolean;
	image?: string;
	imageAlt?: string;
	prev?: string;
	next?: string;
	ogType?: 'website' | 'article';
	publishedTime?: Date;
	modifiedTime?: Date;
	jsonLd?: Record<string, unknown> | Record<string, unknown>[];
	children?: ReactNode;
};
export type ResourceHandler = (context: PageContext) => Response | Promise<Response>;
