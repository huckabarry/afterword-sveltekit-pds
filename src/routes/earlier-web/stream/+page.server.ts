import {
	EARLIER_WEB_STREAM_PAGE_SIZE,
	getEarlierWebStreamHydratedPage
} from '$lib/server/earlier-web';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => ({
	stream: await getEarlierWebStreamHydratedPage(event, { limit: EARLIER_WEB_STREAM_PAGE_SIZE })
});
