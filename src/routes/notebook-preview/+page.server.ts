import { getEarlierWebSeriesPosts } from '$lib/server/earlier-web';

export const prerender = false;

export async function load(event) {
	const posts = await getEarlierWebSeriesPosts(event, {
		minBodyLength: 500,
		limit: 160
	});

	return {
		posts
	};
}
