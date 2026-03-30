import {
	EARLIER_WEB_STREAM_PAGE_SIZE,
	getEarlierWebStreamPage
} from '$lib/server/earlier-web';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => ({
	stream: await getEarlierWebStreamPage(event, { limit: EARLIER_WEB_STREAM_PAGE_SIZE })
});
