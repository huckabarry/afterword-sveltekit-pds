import { error, json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { buildStatusContext, decodeMastodonStatusId } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const objectId = decodeMastodonStatusId(event.params.id);
	if (!objectId) {
		throw error(404, 'Unknown status');
	}

	return json(await buildStatusContext(event, objectId));
}
