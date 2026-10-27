import { SITE_ORIGIN } from '../../../site.config.mjs';
import { splitLocalePath } from '../i18n/locales';
import { RouteControl } from './navigation';
import type { PageContext } from './types';

export const SITE_URL = new URL(SITE_ORIGIN);

/** Public URL determines the locale; caller-provided headers never do. */
export function buildPageContext(
	request: Request,
	params: Record<string, string | undefined> = {},
): PageContext {
	const publicUrl = new URL(request.url);
	const { locale, rest } = splitLocalePath(publicUrl.pathname);
	const url = new URL(publicUrl);
	url.pathname = rest;
	return {
		params,
		url,
		site: SITE_URL,
		request,
		locals: { locale, localePath: rest },
		response: { status: 200, headers: new Headers() },
		redirect(location, status = 302): never {
			throw new RouteControl(status, location);
		},
		notFound(): never {
			throw new RouteControl(404);
		},
	};
}
