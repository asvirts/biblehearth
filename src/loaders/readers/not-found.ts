import { NOTFOUND_CACHE_CONTROL, setCacheControl } from '../../lib/http';
import type { PageContext } from '../../lib/page/types';

/** Loads the NotFound view once on the server. */
export async function loadNotFound(context: PageContext) {
	context.response.status = 404;
	setCacheControl(context.response, NOTFOUND_CACHE_CONTROL);

	return {};
}
