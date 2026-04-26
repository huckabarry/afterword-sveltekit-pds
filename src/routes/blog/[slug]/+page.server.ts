import { error } from '@sveltejs/kit';
import { getBlogPostBySlug, getBlogPosts, type BlogPost } from '$lib/server/ghost';
import { getStandardSiteDocumentAtUri } from '$lib/server/standard-site';

export async function load(event) {
	const { params } = event;
	const [post, posts, standardSiteDocumentAtUri] = await Promise.all([
		getBlogPostBySlug(params.slug),
		getBlogPosts(),
		getStandardSiteDocumentAtUri(params.slug)
	]);

	if (!post) {
		throw error(404, 'Blog post not found');
	}

	const currentIndex = posts.findIndex((entry: BlogPost) => entry.slug === params.slug);

	return {
		post,
		previousPost: currentIndex >= 0 ? posts[currentIndex + 1] || null : null,
		nextPost: currentIndex >= 0 ? posts[currentIndex - 1] || null : null,
		standardSiteDocumentAtUri
	};
}
