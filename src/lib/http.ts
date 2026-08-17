export const READER_CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600';
export const HOME_CACHE_CONTROL = 'public, max-age=300, s-maxage=300';
export const SITEMAP_CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600';
export const ERROR_CACHE_CONTROL = 'no-store';

export function setCacheControl(
	response: { headers: Headers },
	value: string,
): void {
	response.headers.set('Cache-Control', value);
}
