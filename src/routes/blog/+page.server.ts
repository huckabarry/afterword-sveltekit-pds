import { getBlogPosts } from '$lib/server/ghost';

export const prerender = false;

export async function load() {
	return {
		posts: await getBlogPosts()
	};
}
