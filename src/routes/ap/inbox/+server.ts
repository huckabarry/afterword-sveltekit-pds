import { error } from '@sveltejs/kit';
import {
	activityJson,
	createAcceptActivity,
	getActivityPubOrigin,
	getActorId,
	getInboxId
} from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
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

	if (!hasFollowerDb(event)) {
		throw error(500, 'Follower database is not configured');
	}

	const rawBody = await event.request.text();
	const verified = await verifyInboundActivitySignature(event, rawBody);
	const activity = JSON.parse(rawBody) as FollowActivity;

	if (activity.type !== 'Follow') {
		return new Response(
			JSON.stringify({
				error: 'Only Follow activities are supported right now.'
			}),
			{
				status: 501,
				headers: {
					'content-type': 'application/json; charset=utf-8'
				}
			}
		);
	}

	const actorId = getActorIdFromActivity(activity);
	const objectId = getObjectId(activity);
	const localActorId = getActorId(origin);

	if (!actorId || !objectId || objectId !== localActorId) {
		throw error(400, 'Invalid Follow activity');
	}

	if (verified.actorId !== actorId) {
		throw error(401, 'Signed actor did not match Follow actor');
	}

	const remoteActor = await fetchRemoteActor(actorId);
	const endpoints =
		remoteActor.endpoints && typeof remoteActor.endpoints === 'object'
			? (remoteActor.endpoints as Record<string, unknown>)
			: null;

	await upsertFollower(event, {
		actorId,
		inboxUrl: getString(remoteActor.inbox),
		sharedInboxUrl: endpoints ? getString(endpoints.sharedInbox) : null,
		displayName: getString(remoteActor.name),
		handle: getString(remoteActor.preferredUsername),
		followActivityId: String(activity.id || `${actorId}#follow`)
	});

	const acceptActivity = createAcceptActivity(origin, activity);
	const deliveryTarget = endpoints ? getString(endpoints.sharedInbox) || getString(remoteActor.inbox) : getString(remoteActor.inbox);

	if (deliveryTarget) {
		try {
			await sendSignedActivity(origin, deliveryTarget, acceptActivity);
			await updateFollowerDeliveryStatus(event, actorId, 'accept-sent');
		} catch (deliveryError) {
			await updateFollowerDeliveryStatus(
				event,
				actorId,
				`accept-failed:${deliveryError instanceof Error ? deliveryError.message : String(deliveryError)}`
			);
		}
	}

	return activityJson(acceptActivity, { status: 202 });
}
