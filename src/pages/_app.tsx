import type { AppProps } from 'next/app';
import Head from 'next/head';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import { FooterDataContext } from '../components/FooterContext';
import type { PageEnvelope } from '../lib/page/envelope';
import '../styles/global.css';
import '../styles/scripture.css';

export default function App({ Component, pageProps }: AppProps<Partial<PageEnvelope>>) {
	return (
		<FooterDataContext.Provider value={pageProps.footer || { topics: [], answers: [] }}>
			<Head>
				<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
			</Head>
			<Component {...pageProps} />
			<Script
				src="https://www.googletagmanager.com/gtag/js?id=G-E46EVPHNWB"
				strategy="afterInteractive"
			/>
			<Script
				id="google-analytics"
				strategy="afterInteractive"
			>{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-E46EVPHNWB');`}</Script>
			<Script
				src="https://analytics.ahrefs.com/analytics.js"
				data-key="Ow9f9XAzFN0a0KPkYNrfKw"
				strategy="afterInteractive"
			/>
			<Script
				id="microsoft-clarity-init"
				strategy="afterInteractive"
			>{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,'clarity','script','y5ds69hyge');`}</Script>
			<Analytics />
		</FooterDataContext.Provider>
	);
}
