import { error } from '@sveltejs/kit';
import { getStatusBySlug } from '$lib/server/atproto';

export async function load({ params }) {
	const post = await getStatusBySlug(params.slug);

	if (!post) {
		throw error(404, 'Status post not found');
	}

	return { post };
}
