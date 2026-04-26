import { error } from '@sveltejs/kit';
import { getBlogPostBySlug, getBlogPosts, type BlogPost } from '$lib/server/ghost';
import { getStandardSiteDocumentAtUri } from '$lib/server/standard-site';

function truncateExcerpt(text: string, maxLength = 180) {
	const normalized = text.replace(/\s+/g, ' ').trim();
	if (normalized.length <= maxLength) return normalized;

	const truncated = normalized.slice(0, maxLength);
	const lastSpace = truncated.lastIndexOf(' ');
	return `${(lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated).trim()}…`;
}

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
	const previousPost = currentIndex >= 0 ? posts[currentIndex + 1] || null : null;
	const nextPost = currentIndex >= 0 ? posts[currentIndex - 1] || null : null;

	return {
		post,
		previousPost: previousPost
			? {
					...previousPost,
					excerpt: truncateExcerpt(previousPost.excerpt)
				}
			: null,
		nextPost: nextPost
			? {
					...nextPost,
					excerpt: truncateExcerpt(nextPost.excerpt)
				}
			: null,
		standardSiteDocumentAtUri
	};
}
