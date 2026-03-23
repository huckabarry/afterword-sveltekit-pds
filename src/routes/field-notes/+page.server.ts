import { getBlogPosts } from '$lib/server/ghost';

const FIELD_NOTE_TAGS = new Set(['field-notes', 'gallery', 'photography']);
const PLANNING_TAGS = new Set(['urbanism', 'housing', 'transportation', 'public-finance']);

export async function load() {
	const posts = await getBlogPosts();
	const planningIds = new Set(
		posts
			.filter((post) => post.publicTags.some((tag) => PLANNING_TAGS.has(tag.slug)))
			.map((post) => post.id)
	);

	return {
		posts: posts.filter(
			(post) =>
				post.publicTags.some((tag) => FIELD_NOTE_TAGS.has(tag.slug)) && !planningIds.has(post.id)
		)
	};
}
