import { error } from '@sveltejs/kit';
import { getStatusBySlug } from '$lib/server/atproto';
import { getInteractionSummary } from '$lib/server/interactions';
import { getStatusObjectId } from '$lib/server/activitypub';

export async function load(event) {
	const { params } = event;
	const post = await getStatusBySlug(params.slug);

	if (!post) {
		throw error(404, 'Status post not found');
	}

	const fediverse = await getInteractionSummary(event, getStatusObjectId(event.url.origin, post.slug));

	return { post, fediverse };
}
