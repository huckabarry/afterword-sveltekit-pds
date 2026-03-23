import { error } from '@sveltejs/kit';
import { requireDeliveryToken } from '$lib/server/activitypub-admin';
import { getStatusBySlug } from '$lib/server/atproto';
import { deliverStatusPostToFollowers } from '$lib/server/post-delivery';

export async function POST(event) {
	requireDeliveryToken(event.request);

	const post = await getStatusBySlug(event.params.slug);

	if (!post) {
		throw error(404, 'Status post not found');
	}

	const payload = await deliverStatusPostToFollowers(event, post);

	return new Response(JSON.stringify(payload, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8'
		}
	});
}
