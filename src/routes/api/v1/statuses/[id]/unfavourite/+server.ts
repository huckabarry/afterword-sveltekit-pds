import { error, json } from '@sveltejs/kit';
import { getActorId } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { fetchActivityJson, fetchRemoteActor } from '$lib/server/activitypub-replies';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { decodeMastodonStatusId, resolveStatusByObjectId } from '$lib/server/mastodon-api';
import { getFavouriteActivityId, unfavouriteObject } from '$lib/server/mastodon-state';

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
	const activityId = await getFavouriteActivityId(event, objectId);

	if (activityId && !isLocalAfterwordObject(origin, objectId)) {
		const targetObject = await fetchActivityJson(objectId);
		const targetActorId =
			(typeof targetObject.attributedTo === 'string' && targetObject.attributedTo) ||
			(typeof targetObject.actor === 'string' && targetObject.actor) ||
			'';

		if (targetActorId) {
			const remoteActor = await fetchRemoteActor(targetActorId);
			const inboxUrl = remoteActor.sharedInboxUrl || remoteActor.inboxUrl;
			if (inboxUrl) {
				await sendSignedActivity(origin, inboxUrl, {
					'@context': 'https://www.w3.org/ns/activitystreams',
					id: `${getActorId(origin)}/undo/${crypto.randomUUID()}`,
					type: 'Undo',
					actor: getActorId(origin),
					object: {
						id: activityId,
						type: 'Like',
						actor: getActorId(origin),
						object: objectId
					}
				});
			}
		}
	}

	await unfavouriteObject(event, objectId);

	const status = await resolveStatusByObjectId(event, objectId);
	if (!status) {
		throw error(404, 'Unknown status');
	}

	return json(status);
}
