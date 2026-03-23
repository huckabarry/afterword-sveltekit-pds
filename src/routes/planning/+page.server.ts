import { getBlogPosts } from '$lib/server/ghost';

const PLANNING_TAGS = new Set(['urbanism', 'housing', 'transportation', 'public-finance']);

export async function load() {
	const posts = await getBlogPosts();

	return {
		posts: posts.filter((post) => post.publicTags.some((tag) => PLANNING_TAGS.has(tag.slug)))
	};
}
