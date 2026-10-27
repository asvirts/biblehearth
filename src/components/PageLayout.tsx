import Head from 'next/head';
import { SITE_ORIGIN } from '../../site.config.mjs';
import type { PageProps } from '../lib/page/types';
import { absoluteMediaUrl, absoluteUrl } from '../lib/bible/urls';
import { DEFAULT_OG_IMAGE, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '../lib/seo';
import Header from './Header';
import Footer from './Footer';
import { useFooterData, type FooterData } from './FooterContext';
import Analytics from './Analytics';

const site = new URL(SITE_ORIGIN);
const dateString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

/** Reuse page data for HTML metadata; verification strings are already public. */
export function pageMetadataElements(
	{
		title,
		description,
		canonicalPath,
		noindex,
		markdown,
		lang = 'en',
		alternates = [],
		image = DEFAULT_OG_IMAGE,
		imageAlt = 'BibleHearth — read the Bible online, free',
		prev,
		next,
		ogType = 'website',
		publishedTime,
		modifiedTime,
		jsonLd,
	}: PageProps,
	verification: FooterData['verification'] = {},
) {
	const canonical = canonicalPath ? absoluteUrl(site, canonicalPath) : undefined;
	const ogImage = absoluteMediaUrl(site, image);
	const documents = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
	const english = alternates.find((entry) => entry.hreflang === 'en');
	return (
		<>
			<title>{title}</title>
			<meta name="description" content={description} />
			<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
			<meta name="theme-color" content="#f7f1e8" />
			<link rel="icon" href="/favicon.ico?v=2" sizes="32x32" />
			<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=2" />
			<link rel="icon" type="image/png" href="/favicon.png?v=2" sizes="32x32" />
			<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
			{verification?.bing ? <meta name="msvalidate.01" content={verification.bing} /> : null}
			{verification?.google ? (
				<meta name="google-site-verification" content={verification.google} />
			) : null}
			{noindex ? <meta name="robots" content="noindex, follow" /> : null}
			{canonical ? <link rel="canonical" href={canonical} /> : null}
			{alternates.map((entry) => (
				<link
					key={entry.hreflang}
					rel="alternate"
					hrefLang={entry.hreflang}
					href={absoluteUrl(site, entry.href)}
				/>
			))}
			{english ? (
				<link rel="alternate" hrefLang="x-default" href={absoluteUrl(site, english.href)} />
			) : null}
			{prev ? <link rel="prev" href={absoluteUrl(site, prev)} /> : null}
			{next ? <link rel="next" href={absoluteUrl(site, next)} /> : null}
			{markdown && canonical ? (
				<link rel="alternate" type="text/markdown" href={`${canonical}.md`} />
			) : null}
			<link rel="describedby" href={absoluteUrl(site, '/llms.txt')} />
			<meta property="og:title" content={title} />
			<meta property="og:description" content={description} />
			{canonical ? <meta property="og:url" content={canonical} /> : null}
			<meta property="og:type" content={ogType} />
			{ogType === 'article' && publishedTime ? (
				<meta property="article:published_time" content={dateString(publishedTime)} />
			) : null}
			{ogType === 'article' && modifiedTime ? (
				<meta property="article:modified_time" content={dateString(modifiedTime)} />
			) : null}
			<meta property="og:site_name" content="BibleHearth" />
			<meta property="og:locale" content={lang.replace('-', '_')} />
			<meta property="og:image" content={ogImage} />
			{image === DEFAULT_OG_IMAGE ? (
				<meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
			) : null}
			{image === DEFAULT_OG_IMAGE ? (
				<meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
			) : null}
			<meta property="og:image:alt" content={imageAlt} />
			<meta name="twitter:card" content="summary_large_image" />
			<meta name="twitter:title" content={title} />
			<meta name="twitter:description" content={description} />
			<meta name="twitter:image" content={ogImage} />
			<meta name="twitter:image:alt" content={imageAlt} />
			{documents.map((document, i) => (
				<script
					key={i}
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(document).replaceAll('<', '\\u003c') }}
				/>
			))}
		</>
	);
}

export default function PageLayout(props: PageProps) {
	const { verification } = useFooterData();
	return (
		<>
			<Head>{pageMetadataElements(props, verification)}</Head>
			<a className="skip-link" href="#content">
				Skip to content
			</a>
			<Header path={props.canonicalPath} />
			<main id="content" className="wrap page">
				{props.children}
			</main>
			<Footer />
			<Analytics />
		</>
	);
}
