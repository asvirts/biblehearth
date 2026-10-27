import type { NextConfig } from 'next';
const config: NextConfig = {
	poweredByHeader: false,
	trailingSlash: false,
	outputFileTracingIncludes: {
		'/*': ['./src/content/**/*.md', './public/editorial/**/*', './src/assets/editorial/**/*'],
	},
};
export default config;
