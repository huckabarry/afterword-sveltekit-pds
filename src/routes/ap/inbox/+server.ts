import { error } from '@sveltejs/kit';
import {
	activityJson,
	createAcceptActivity,
	getActivityPubOrigin,
	getActorId,
	getInboxId
} from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { recordInteraction } from '$lib/server/interactions';
import { verifyInboundActivitySignature } from '$lib/server/activitypub-signatures';
import { hasFollowerDb, updateFollowerDeliveryStatus, upsertFollower } from '$lib/server/followers';

export function GET(event) {
	const origin = getActivityPubOrigin(event);

	return activityJson({
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: getInboxId(origin),
		type: 'OrderedCollection',
		totalItems: 0,
		orderedItems: []
	});
}

type FollowActivity = {
	'@context'?: unknown;
	id?: string;
	type?: string;
	actor?: string | Record<string, unknown>;
	object?: string | Record<string, unknown>;
};

type SupportedInboxActivity = FollowActivity & {
	type?: string;
};

async function fetchRemoteActor(actorId: string) {
	const response = await fetch(actorId, {
		headers: {
			Accept: 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
		}
	});

	if (!response.ok) {
		throw new Error(`Remote actor fetch failed with ${response.status}`);
	}

	return (await response.json()) as Record<string, unknown>;
}

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getActorIdFromActivity(activity: FollowActivity) {
	if (typeof activity.actor === 'string') return activity.actor.trim();
	if (activity.actor && typeof activity.actor === 'object') {
		return getString((activity.actor as Record<string, unknown>).id);
	}
	return null;
}

function getObjectId(activity: FollowActivity) {
	if (typeof activity.object === 'string') return activity.object.trim();
	if (activity.object && typeof activity.object === 'object') {
		return getString((activity.object as Record<string, unknown>).id);
	}
	return null;
}

export async function POST(event) {
	const origin = getActivityPubOrigin(event);

	try {
		if (!hasFollowerDb(event)) {
			console.error('[ap/inbox] follower database is not configured');
			throw error(500, 'Follower database is not configured');
		}

		const rawBody = await event.request.text();
		console.log('[ap/inbox] received payload', rawBody.slice(0, 500));

		const verified = await verifyInboundActivitySignature(event, rawBody);
		const activity = JSON.parse(rawBody) as SupportedInboxActivity;

		const actorId = getActorIdFromActivity(activity);
		const activityId = String(activity.id || '').trim() || `${actorId || 'unknown'}#activity`;

		if (!actorId) {
			console.error('[ap/inbox] missing actor on activity', { activityType: activity.type });
			throw error(400, 'Activity actor is required');
		}

		if (verified.actorId !== actorId) {
			console.error('[ap/inbox] actor mismatch', { verifiedActorId: verified.actorId, actorId });
			throw error(401, 'Signed actor did not match activity actor');
		}

		const remoteActor = await fetchRemoteActor(actorId);
		const endpoints =
			remoteActor.endpoints && typeof remoteActor.endpoints === 'object'
				? (remoteActor.endpoints as Record<string, unknown>)
				: null;

		if (activity.type === 'Follow') {
			const objectId = getObjectId(activity);
			const localActorId = getActorId(origin);

			if (!objectId || objectId !== localActorId) {
				console.error('[ap/inbox] invalid follow activity', { actorId, objectId, localActorId });
				throw error(400, 'Invalid Follow activity');
			}

			await upsertFollower(event, {
				actorId,
				inboxUrl: getString(remoteActor.inbox),
				sharedInboxUrl: endpoints ? getString(endpoints.sharedInbox) : null,
				displayName: getString(remoteActor.name),
				handle: getString(remoteActor.preferredUsername),
				followActivityId: String(activity.id || `${actorId}#follow`)
			});

			console.log('[ap/inbox] follower stored', actorId);

			const acceptActivity = createAcceptActivity(origin, activity);
			const deliveryTarget = endpoints
				? getString(endpoints.sharedInbox) || getString(remoteActor.inbox)
				: getString(remoteActor.inbox);

			if (deliveryTarget) {
				try {
					await sendSignedActivity(origin, deliveryTarget, acceptActivity);
					await updateFollowerDeliveryStatus(event, actorId, 'accept-sent');
					console.log('[ap/inbox] accept delivered', { actorId, deliveryTarget });
				} catch (deliveryError) {
					const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
					await updateFollowerDeliveryStatus(event, actorId, `accept-failed:${message}`);
					console.error('[ap/inbox] accept delivery failed', { actorId, deliveryTarget, message });
				}
			}

			return activityJson(acceptActivity, { status: 202 });
		}

		if (activity.type === 'Like' || activity.type === 'Announce') {
			const objectId = getObjectId(activity);

			if (!objectId) {
				throw error(400, `${activity.type} activity is missing an object`);
			}

			const objectUrl =
				typeof activity.object === 'string'
					? activity.object
					: activity.object && typeof activity.object === 'object'
						? getString((activity.object as Record<string, unknown>).url) || getString((activity.object as Record<string, unknown>).id)
						: null;

			await recordInteraction(event, {
				activityId,
				activityType: activity.type,
				actorId,
				objectId,
				objectUrl,
				rawActivityJson: rawBody
			});

			console.log('[ap/inbox] interaction stored', {
				activityType: activity.type,
				actorId,
				objectId
			});

			return new Response(null, { status: 202 });
		}

		console.log('[ap/inbox] unsupported activity type', activity.type);
		return new Response(
			JSON.stringify({
				error: 'Only Follow, Like, and Announce activities are supported right now.'
			}),
			{
				status: 501,
				headers: {
					'content-type': 'application/json; charset=utf-8'
				}
			}
		);
	} catch (err) {
		console.error('[ap/inbox] request failed', err);
		throw err;
	}
}
