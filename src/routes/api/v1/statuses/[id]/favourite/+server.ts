import { error, json } from '@sveltejs/kit';
import { getActorId } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { fetchActivityJson, fetchRemoteActor } from '$lib/server/activitypub-replies';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { decodeMastodonStatusId, resolveStatusByObjectId } from '$lib/server/mastodon-api';
import { favouriteObject } from '$lib/server/mastodon-state';

function isLocalAfterwordObject(origin: string, objectId: string) {
	return objectId.startsWith(`${origin}/ap/`);
}

export async function POST(event) {
	await requireMastodonAccessToken(event);

	const objectId = decodeMastodonStatusId(event.params.id);
	if (!objectId) {
		throw error(404, 'Unknown status');
	}

	const origin = event.url.origin;
	let activityId: string | null = null;

	if (!isLocalAfterwordObject(origin, objectId)) {
		const targetObject = await fetchActivityJson(objectId);
		const targetActorId =
			(typeof targetObject.attributedTo === 'string' && targetObject.attributedTo) ||
			(typeof targetObject.actor === 'string' && targetObject.actor) ||
			'';

		if (!targetActorId) {
			throw error(400, 'Target object does not declare an actor');
		}

		const remoteActor = await fetchRemoteActor(targetActorId);
		const inboxUrl = remoteActor.sharedInboxUrl || remoteActor.inboxUrl;
		if (!inboxUrl) {
			throw error(400, 'Target actor does not expose an inbox');
		}

		activityId = `${getActorId(origin)}/likes/${crypto.randomUUID()}`;
		await sendSignedActivity(origin, inboxUrl, {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: activityId,
			type: 'Like',
			actor: getActorId(origin),
			object: objectId
		});
	}

	await favouriteObject(event, { objectId, activityId });

	const status = await resolveStatusByObjectId(event, objectId);
	if (!status) {
		throw error(404, 'Unknown status');
	}

	return json(status);
}
