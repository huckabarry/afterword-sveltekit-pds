import type { RequestEvent } from '@sveltejs/kit';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { blogPostToCreateActivity, getActivityPubOrigin } from '$lib/server/activitypub';
import { listDeliveredFollowerActorIds, recordDeliveryAttempt } from '$lib/server/deliveries';
import { listFollowers } from '$lib/server/followers';
import type { BlogPost } from '$lib/server/ghost';

export type PostDeliveryResult = {
	actorId: string;
	inboxUrl: string | null;
	status: string;
	error?: string;
};

export async function deliverBlogPostToFollowers(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	post: BlogPost,
	options?: {
		skipDelivered?: boolean;
	}
) {
	const origin = getActivityPubOrigin(event);
	const followers = await listFollowers(event);
	const activity = blogPostToCreateActivity(post, origin);
	const objectId = String(activity.object?.id || `${origin}${post.path}`);
	const objectUrl = `${origin}${post.path}`;
	const deliveredFollowerIds = options?.skipDelivered
		? await listDeliveredFollowerActorIds(event, objectId)
		: new Set<string>();
	const results: PostDeliveryResult[] = [];

	for (const follower of followers) {
		const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl;

		if (options?.skipDelivered && deliveredFollowerIds.has(follower.actorId)) {
			results.push({
				actorId: follower.actorId,
				inboxUrl,
				status: 'already-delivered'
			});
			continue;
		}

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

	return {
		post: {
			slug: post.slug,
			title: post.title,
			path: post.path
		},
		followerCount: followers.length,
		results
	};
}
