import type { PageContext } from '../../lib/page/types';
import { COMMENTARY_SOURCES } from '../../lib/commentary/sources';
import { READER_CACHE_CONTROL, setCacheControl } from '../../lib/http';
import { listAttributedFigures } from '../../lib/images/list';
import { licenseDisplayName } from '../../lib/images/types';
import { breadcrumbJsonLd } from '../../lib/seo';

export async function loadAttributions(context: PageContext) {
	setCacheControl(context.response, READER_CACHE_CONTROL);

	const figures = await listAttributedFigures();

	const title = 'Attributions and Licenses · BibleHearth';
	const description =
		'Every source BibleHearth reproduces or links to, including its Bible translations and public-domain or Creative Commons commentaries.';

	return { site: context.site.toString(), figures, title, description };
}
