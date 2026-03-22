import { error } from '@sveltejs/kit';
import { getBlogPostsByTag, getPublicTags } from '$lib/server/ghost';

export const prerender = false;

export async function load({ params }) {
	const [tags, posts] = await Promise.all([getPublicTags(), getBlogPostsByTag(params.slug)]);
	const tag = tags.find((entry) => entry.slug === params.slug);

	if (!tag) {
		throw error(404, 'Tag not found');
	}

	return {
		tag,
		posts
	};
}
