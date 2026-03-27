import { buildAdminPostFeed } from '$lib/server/admin-posts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		posts: await buildAdminPostFeed(event, {
			localLimit: 200,
			mirroredLimit: 50
		}),
		deleted: event.url.searchParams.get('deleted') === '1',
		saved: event.url.searchParams.get('saved') === '1'
	};
};
