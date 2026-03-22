import { getStatuses } from '$lib/server/atproto';
import { getBlogPosts } from '$lib/server/ghost';

export async function load() {
	const [statuses, blogPosts] = await Promise.all([getStatuses(), getBlogPosts()]);

	return {
		statuses: statuses.slice(0, 8),
		blogPosts: blogPosts.slice(0, 3)
	};
}
