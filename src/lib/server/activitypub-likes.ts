import { getActorId } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { fetchActivityJson, fetchRemoteActor } from '$lib/server/activitypub-replies';

export function createLikeActivity(origin: string, objectId: string) {
	const actorId = getActorId(origin);

	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${actorId}/likes/${crypto.randomUUID()}`,
		type: 'Like',
		actor: actorId,
		object: objectId
	};
}

export async function deliverLikeToRemoteObject(origin: string, objectId: string) {
	const targetObject = await fetchActivityJson(objectId);
	const attributedTo =
		(typeof targetObject.attributedTo === 'string' && targetObject.attributedTo.trim()) ||
		(typeof targetObject.actor === 'string' && targetObject.actor.trim()) ||
		null;

	if (!attributedTo) {
		throw new Error('Target object does not declare an actor');
	}

	const remoteActor = await fetchRemoteActor(attributedTo);
	const targetInbox = remoteActor.sharedInboxUrl || remoteActor.inboxUrl;

	if (!targetInbox) {
		throw new Error('Target actor does not expose an inbox');
	}

	const activity = createLikeActivity(origin, objectId);
	await sendSignedActivity(origin, targetInbox, activity);

	return {
		targetActorId: remoteActor.id,
		targetInbox
	};
}
