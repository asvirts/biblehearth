import Document, { Html, Head, Main, NextScript } from 'next/document';
export default class SiteDocument extends Document {
	render() {
		const props = this.props.__NEXT_DATA__.props.pageProps || {};
		return (
			<Html lang={props.lang || 'en'} dir={props.dir || 'ltr'}>
				<Head />
				<body>
					<Main />
					<NextScript />
				</body>
			</Html>
		);
	}
}
