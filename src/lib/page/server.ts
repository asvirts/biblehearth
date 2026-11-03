import type {
	GetServerSidePropsContext,
	GetServerSidePropsResult,
	NextApiRequest,
	NextApiResponse,
} from 'next';
import type { IncomingMessage, ServerResponse } from 'node:http';
import superjson from 'superjson';
import { listTopics } from '../topics';
import { listAnswers } from '../answers';
import { matchPage } from './routes';
import { loaders } from './loaders';
import { buildPageContext } from './context';
import { isRouteControl } from './navigation';
import type { PageEnvelope } from './envelope';
import { dispatchResource, isResourcePath } from '../../resources/dispatch';

/** Secrets stay on this server graph, eliminated from the hydrated page bundle. */
export function webRequest(req: IncomingMessage, pathname = req.url || '/'): Request {
	const headers = new Headers();
	for (const [name, value] of Object.entries(req.headers)) {
		if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
		else if (value !== undefined) headers.set(name, value);
	}
	const host = headers.get('host') || 'localhost';
	const url = new URL(pathname, `http://${host}`);
	return new Request(url, { method: req.method || 'GET', headers });
}

export async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
	res.statusCode = response.status;
	response.headers.forEach((value, name) => res.setHeader(name, value));
	res.end(Buffer.from(await response.arrayBuffer()));
}

export async function getPageProps(
	ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<PageEnvelope>> {
	const request = webRequest(ctx.req, ctx.resolvedUrl);
	const context = buildPageContext(request);
	if (isResourcePath(new URL(request.url).pathname)) {
		await sendResponse(ctx.res, await dispatchResource(request));
		return {
			props: {
				kind: 'NotFound',
				data: '{}',
				footer: { topics: [], answers: [] },
				lang: 'en',
				dir: 'ltr',
			},
		};
	}
	try {
		const match = matchPage(new URL(request.url).pathname);
		context.params = match.params;
		let kind = match.kind;
		let model: unknown;
		try {
			model = await loaders[kind](context);
		} catch (error) {
			if (!isRouteControl(error) || error.status !== 404) throw error;
			kind = 'NotFound';
			model = await loaders.NotFound(context);
		}
		// Last-Modified based on an editorial review date cannot validate the full
		// rendered page: its template, navigation, and licensed passage can change
		// independently. Keep date metadata in the HTML, but let Next compare the
		// rendered response body against its ETag for conditional requests.
		context.response.headers.delete('Last-Modified');
		const [topics, answers] = await Promise.all([listTopics(), listAnswers()]);
		ctx.res.statusCode = context.response.status;
		context.response.headers.forEach((value, name) => ctx.res.setHeader(name, value));
		const localized = (model as { locale?: { htmlLang: string; dir: 'ltr' | 'rtl' } })?.locale;
		ctx.res.setHeader('Content-Language', localized?.htmlLang || 'en');
		return {
			props: {
				kind,
				data: superjson.stringify(model),
				lang: localized?.htmlLang || 'en',
				dir: localized?.dir || 'ltr',
				footer: {
					topics: topics.slice(0, 5).map(({ id, data }) => ({ id, data: { title: data.title } })),
					answers: answers.slice(0, 5).map(({ id, data }) => ({ id, data: { label: data.label } })),
					verification: {
						...(process.env.GOOGLE_SITE_VERIFICATION
							? { google: process.env.GOOGLE_SITE_VERIFICATION }
							: {}),
						...(process.env.BING_SITE_VERIFICATION
							? { bing: process.env.BING_SITE_VERIFICATION }
							: {}),
					},
				},
			},
		};
	} catch (error) {
		if (isRouteControl(error) && error.location) {
			return {
				redirect: {
					destination: error.location,
					statusCode: error.status as 301 | 302 | 303 | 307 | 308,
				},
			};
		}
		throw error;
	}
}

export async function apiResource(req: NextApiRequest, res: NextApiResponse): Promise<void> {
	await sendResponse(res, await dispatchResource(webRequest(req)));
}
