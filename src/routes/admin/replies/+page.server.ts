import { listRecentRemoteReplies } from '$lib/server/ap-notes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		replies: await listRecentRemoteReplies(event, 50),
		sent: event.url.searchParams.get('sent') === '1'
	};
};
