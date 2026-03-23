import { error } from '@sveltejs/kit';
import { requireDeliveryToken } from '$lib/server/activitypub-admin';
import { getBlogPostBySlug } from '$lib/server/ghost';
import { deliverBlogPostToFollowers } from '$lib/server/post-delivery';

export async function POST(event) {
	requireDeliveryToken(event.request);
	const post = await getBlogPostBySlug(event.params.slug);

	if (!post) {
		throw error(404, 'Blog post not found');
	}
	const payload = await deliverBlogPostToFollowers(event, post);

	return new Response(
		JSON.stringify(payload, null, 2),
		{
			headers: {
				'content-type': 'application/json; charset=utf-8'
			}
		}
	);
}
