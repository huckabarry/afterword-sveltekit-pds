import { error, json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { decodeMastodonStatusId, buildLocalAccount } from '$lib/server/mastodon-api';
import { isObjectReblogged } from '$lib/server/mastodon-state';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const objectId = decodeMastodonStatusId(event.params.id);
	if (!objectId) throw error(404, 'Unknown status');

	const reblogged = await isObjectReblogged(event, objectId);
	return json(reblogged ? [await buildLocalAccount(event)] : []);
}
