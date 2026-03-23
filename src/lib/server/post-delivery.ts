import type { RequestEvent } from '@sveltejs/kit';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import {
	blogPostToCreateActivity,
	getActivityPubOrigin,
	statusPostToCreateActivity
} from '$lib/server/activitypub';
import { listDeliveredFollowerActorIds, recordDeliveryAttempt } from '$lib/server/deliveries';
import { listFollowers } from '$lib/server/followers';
import type { BlogPost } from '$lib/server/ghost';
import type { StatusPost } from '$lib/server/atproto';

export type PostDeliveryResult = {
	actorId: string;
	inboxUrl: string | null;
	status: string;
	error?: string;
};

async function deliverActivityToFollowers(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	input: {
		objectId: string;
		objectUrl: string;
		activityId: string;
		activity: Record<string, unknown>;
		skipDelivered?: boolean;
	}
) {
	const origin = getActivityPubOrigin(event);
	const followers = await listFollowers(event);
	const deliveredFollowerIds = input.skipDelivered
		? await listDeliveredFollowerActorIds(event, input.objectId)
		: new Set<string>();
	const results: PostDeliveryResult[] = [];

	for (const follower of followers) {
		const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl;

		if (input.skipDelivered && deliveredFollowerIds.has(follower.actorId)) {
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
			const response = await sendSignedActivity(origin, inboxUrl, input.activity);
			await recordDeliveryAttempt(event, {
				objectId: input.objectId,
				objectUrl: input.objectUrl,
				followerActorId: follower.actorId,
				inboxUrl,
				activityId: input.activityId,
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
				objectId: input.objectId,
				objectUrl: input.objectUrl,
				followerActorId: follower.actorId,
				inboxUrl,
				activityId: input.activityId,
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
		followerCount: followers.length,
		results
	};
}

export async function deliverBlogPostToFollowers(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	post: BlogPost,
	options?: {
		skipDelivered?: boolean;
	}
) {
	const origin = getActivityPubOrigin(event);
	const activity = blogPostToCreateActivity(post, origin);
	const objectId = String(activity.object?.id || `${origin}${post.path}`);
	const objectUrl = `${origin}${post.path}`;
	const delivery = await deliverActivityToFollowers(event, {
		objectId,
		objectUrl,
		activityId: String(activity.id),
		activity,
		skipDelivered: options?.skipDelivered
	});

	return {
		post: {
			slug: post.slug,
			title: post.title,
			path: post.path
		},
		followerCount: delivery.followerCount,
		results: delivery.results
	};
}

export async function deliverStatusPostToFollowers(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	post: StatusPost,
	options?: {
		skipDelivered?: boolean;
	}
) {
	const origin = getActivityPubOrigin(event);
	const activity = statusPostToCreateActivity(post, origin);
	const objectId = String(activity.object?.id || `${origin}/status/${post.slug}`);
	const objectUrl = `${origin}/status/${post.slug}`;
	const delivery = await deliverActivityToFollowers(event, {
		objectId,
		objectUrl,
		activityId: String(activity.id),
		activity,
		skipDelivered: options?.skipDelivered
	});

	return {
		post: {
			slug: post.slug,
			title: post.text.slice(0, 80) || post.slug,
			path: `/status/${post.slug}`
		},
		followerCount: delivery.followerCount,
		results: delivery.results
	};
}
