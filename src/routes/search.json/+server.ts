import { json } from '@sveltejs/kit';
import { searchPosts } from '$lib/server/search';

export const prerender = false;

export async function GET(event) {
	const query = event.url.searchParams.get('q') || '';
	const results = await searchPosts(event, query, 8);

	return json({
		query,
		results
	});
}
