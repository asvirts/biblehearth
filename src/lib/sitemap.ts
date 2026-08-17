import { absoluteUrl } from './bible/urls';

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

export function urlsetXml(site: URL | undefined, paths: readonly string[]): string {
	const urls = paths
		.map(
			(path) =>
				`  <url>\n    <loc>${escapeXml(absoluteUrl(site, path))}</loc>\n  </url>`,
		)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function sitemapIndexXml(
	site: URL | undefined,
	paths: readonly string[],
): string {
	const items = paths
		.map(
			(path) =>
				`  <sitemap>\n    <loc>${escapeXml(absoluteUrl(site, path))}</loc>\n  </sitemap>`,
		)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

export function xmlResponse(body: string): Response {
	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
		},
	});
}
