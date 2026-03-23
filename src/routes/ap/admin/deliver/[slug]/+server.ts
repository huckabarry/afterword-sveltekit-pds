import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { blogPostToCreateActivity, getActivityPubOrigin } from '$lib/server/activitypub';
import { recordDeliveryAttempt } from '$lib/server/deliveries';
import { listFollowers } from '$lib/server/followers';
import { getBlogPostBySlug } from '$lib/server/ghost';

function getBearerToken(request: Request) {
	const header = request.headers.get('authorization') || '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	return match?.[1]?.trim() || null;
}

function requireDeliveryToken(request: Request) {
	const expected = String(env.ACTIVITYPUB_DELIVERY_TOKEN || '').trim();

	if (!expected) {
		throw error(500, 'ACTIVITYPUB_DELIVERY_TOKEN is not configured');
	}

	const provided =
		getBearerToken(request) ||
		request.headers.get('x-activitypub-token')?.trim() ||
		new URL(request.url).searchParams.get('token')?.trim() ||
		null;

	if (!provided || provided !== expected) {
		throw error(401, 'Invalid delivery token');
	}
}

export async function POST(event) {
	requireDeliveryToken(event.request);

	const origin = getActivityPubOrigin(event);
	const post = await getBlogPostBySlug(event.params.slug);

	if (!post) {
		throw error(404, 'Blog post not found');
	}

	const followers = await listFollowers(event);
	const activity = blogPostToCreateActivity(post, origin);
	const objectId = String(activity.object?.id || `${origin}${post.path}`);
	const objectUrl = `${origin}${post.path}`;
	const results: Array<{
		actorId: string;
		inboxUrl: string | null;
		status: string;
		error?: string;
	}> = [];

	for (const follower of followers) {
		const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl;

		if (!inboxUrl) {
			results.push({
				actorId: follower.actorId,
				inboxUrl: null,
				status: 'skipped',
				error: 'No inbox URL available'
			});
			continue;
		}

		try {
			const response = await sendSignedActivity(origin, inboxUrl, activity);
			await recordDeliveryAttempt(event, {
				objectId,
				objectUrl,
				followerActorId: follower.actorId,
				inboxUrl,
				activityId: String(activity.id),
				status: 'delivered',
				responseStatus: response.status,
				deliveredAt: new Date().toISOString()
			});
			results.push({
				actorId: follower.actorId,
				inboxUrl,
				status: 'delivered'
			});
		} catch (deliveryError) {
			const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
			await recordDeliveryAttempt(event, {
				objectId,
				objectUrl,
				followerActorId: follower.actorId,
				inboxUrl,
				activityId: String(activity.id),
				status: 'failed',
				errorMessage: message
			});
			results.push({
				actorId: follower.actorId,
				inboxUrl,
				status: 'failed',
				error: message
			});
		}
	}

	return new Response(
		JSON.stringify(
			{
				post: {
					slug: post.slug,
					title: post.title,
					path: post.path
				},
				followerCount: followers.length,
				results
			},
			null,
			2
		),
		{
			headers: {
				'content-type': 'application/json; charset=utf-8'
			}
		}
	);
}
