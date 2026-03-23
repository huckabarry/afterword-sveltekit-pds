import { error } from '@sveltejs/kit';
import { getBlogPostBySlug, getBlogPosts, type BlogPost } from '$lib/server/ghost';
import { listVerifiedWebmentionsForTarget } from '$lib/server/webmentions';
import { getInteractionSummary } from '$lib/server/interactions';
import { getNoteObjectId } from '$lib/server/activitypub';

export async function load(event) {
	const { params } = event;
	const [post, posts] = await Promise.all([getBlogPostBySlug(params.slug), getBlogPosts()]);

	if (!post) {
		throw error(404, 'Blog post not found');
	}

	const currentIndex = posts.findIndex((entry: BlogPost) => entry.slug === params.slug);
	const [webmentions, fediverse] = await Promise.all([
		listVerifiedWebmentionsForTarget(event, `${event.url.origin}${post.path}`),
		getInteractionSummary(event, getNoteObjectId(event.url.origin, post.slug))
	]);

	return {
		post,
		previousPost: currentIndex >= 0 ? posts[currentIndex + 1] || null : null,
		nextPost: currentIndex >= 0 ? posts[currentIndex - 1] || null : null,
		webmentions,
		fediverse
	};
}
