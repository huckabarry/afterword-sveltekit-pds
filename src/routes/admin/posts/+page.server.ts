import { buildAdminPostFeed } from '$lib/server/admin-posts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		posts: await buildAdminPostFeed()
	};
};
