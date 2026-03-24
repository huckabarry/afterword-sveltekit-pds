import { error, json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { decodeMastodonStatusId, resolveStatusByObjectId } from '$lib/server/mastodon-api';
import { unpinStatus } from '$lib/server/mastodon-state';

export async function POST(event) {
	await requireMastodonAccessToken(event);

	const objectId = decodeMastodonStatusId(event.params.id);
	if (!objectId) throw error(404, 'Unknown status');

	await unpinStatus(event, objectId);
	const status = await resolveStatusByObjectId(event, objectId);
	if (!status) throw error(404, 'Unknown status');

	return json(status);
}
