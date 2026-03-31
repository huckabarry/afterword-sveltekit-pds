import { error } from '@sveltejs/kit';
import { getNowPostBySlug, getNowPosts, type BlogPost } from '$lib/server/ghost';
import { getStandardSiteDocumentAtUri } from '$lib/server/standard-site';
import { listVerifiedWebmentionsForTarget } from '$lib/server/webmentions';

export async function load(event) {
	const { params } = event;
	const [post, posts, webmentions, standardSiteDocumentAtUri] = await Promise.all([
		getNowPostBySlug(params.slug),
		getNowPosts(),
		listVerifiedWebmentionsForTarget(event, `${event.url.origin}/now/${params.slug}`),
		getStandardSiteDocumentAtUri(params.slug)
	]);

	if (!post) {
		throw error(404, 'Now post not found');
	}

	const currentIndex = posts.findIndex((entry: BlogPost) => entry.slug === params.slug);

	return {
		post,
		previousPost: currentIndex >= 0 ? posts[currentIndex + 1] || null : null,
		nextPost: currentIndex >= 0 ? posts[currentIndex - 1] || null : null,
		webmentions,
		standardSiteDocumentAtUri
	};
}
