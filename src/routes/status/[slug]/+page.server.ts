import { error } from '@sveltejs/kit';
import { getStatusBySlug } from '$lib/server/atproto';

export async function load(event) {
	const post = await getStatusBySlug(event.params.slug);

	if (!post) {
		throw error(404, 'Status post not found');
	}

	return { post };
}
