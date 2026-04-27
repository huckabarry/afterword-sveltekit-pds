import { error } from '@sveltejs/kit';
import { getBlogPostBySlug, getBlogPosts } from '$lib/server/ghost';
import { getSimplePost } from '$lib/simple-site';
import { toTemplatePosts } from '$lib/server/template-posts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ params, url }) => {
	if (url.hostname === 'svelte.afterword.blog') {
		const simplePost = getSimplePost(params.slug);

		if (!simplePost) {
			throw error(404, 'Post not found');
		}

		return {
			simplePost
		};
	}

	const post = await getBlogPostBySlug(params.slug);

	if (!post) {
		throw error(404, 'Post not found');
	}

	const posts = toTemplatePosts(await getBlogPosts());
	const templatePost = posts.find((entry) => entry.slug === params.slug);

	if (!templatePost) {
		throw error(404, 'Post not found');
	}

	return {
		post: templatePost
	};
};
