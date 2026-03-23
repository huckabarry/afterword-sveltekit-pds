import { listFollowers } from '$lib/server/followers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		followers: await listFollowers(event)
	};
};
