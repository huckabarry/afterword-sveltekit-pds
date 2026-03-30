import { searchPosts } from '$lib/server/search';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async (event) => {
	const query = String(event.url.searchParams.get('q') || '').trim();

	return {
		query,
		results: await searchPosts(event, query, 24)
	};
};
