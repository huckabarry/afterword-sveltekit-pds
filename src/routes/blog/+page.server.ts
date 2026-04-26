import { getBlogPosts } from '$lib/server/ghost';
import type { PageServerLoad } from './$types';

export const prerender = false;

const PLANNING_TAGS = new Set(['urbanism', 'housing', 'transportation', 'public-finance']);
const FIELD_NOTE_TAGS = new Set(['field-notes', 'gallery', 'photography']);

export const load: PageServerLoad = async (event) => {
	const posts = await getBlogPosts();

	const planningPosts = posts.filter((post) =>
		post.publicTags.some((tag) => PLANNING_TAGS.has(tag.slug))
	);

	const planningIds = new Set(planningPosts.map((post) => post.id));

	const fieldNotePosts = posts.filter(
		(post) =>
			post.publicTags.some((tag) => FIELD_NOTE_TAGS.has(tag.slug)) && !planningIds.has(post.id)
	);

	event.setHeaders({
		'cache-control': 'public, max-age=60, s-maxage=240, stale-while-revalidate=600'
	});

	return {
		latestBlogPosts: planningPosts.slice(0, 3).map((post) => ({
			title: post.title,
			excerpt: post.excerpt,
			path: post.path,
			coverImage: post.coverImage,
			publishedAt: post.publishedAt.toISOString()
		})),
		latestFieldNotes: fieldNotePosts.slice(0, 3).map((post) => ({
			title: post.title,
			excerpt: post.excerpt,
			path: post.path,
			coverImage: post.coverImage,
			publishedAt: post.publishedAt.toISOString()
		}))
	};
};
