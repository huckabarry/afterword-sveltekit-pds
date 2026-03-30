import { buildAdminPostFeed } from '$lib/server/admin-posts';
import { requireAdminSession } from '$lib/server/admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireAdminSession(event);

	return {
		posts: await buildAdminPostFeed()
	};
};
