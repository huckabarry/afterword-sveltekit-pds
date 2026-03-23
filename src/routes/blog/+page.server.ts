import { getBlogPosts } from '$lib/server/ghost';

export const prerender = false;

const BLOG_INDEX_TAGS = new Set([
	'field-notes',
	'gallery',
	'photography',
	'urbanism',
	'housing',
	'transportation',
	'public-finance'
]);

export async function load() {
	const posts = await getBlogPosts();

	return {
		posts: posts.filter((post) => post.publicTags.some((tag) => BLOG_INDEX_TAGS.has(tag.slug)))
	};
}
