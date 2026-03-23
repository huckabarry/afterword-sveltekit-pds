import { listLocalNotes } from '$lib/server/ap-notes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		posts: await listLocalNotes(event, 200),
		deleted: event.url.searchParams.get('deleted') === '1',
		saved: event.url.searchParams.get('saved') === '1'
	};
};
