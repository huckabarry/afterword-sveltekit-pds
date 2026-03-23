import { error, json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { decodeMastodonStatusId, resolveStatusByObjectId } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const objectId = decodeMastodonStatusId(event.params.id);
	if (!objectId) {
		throw error(404, 'Unknown status');
	}

	const status = await resolveStatusByObjectId(event, objectId);
	if (!status) {
		throw error(404, 'Unknown status');
	}

	return json(status);
}
