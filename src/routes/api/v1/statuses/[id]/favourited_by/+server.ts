import { error, json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { decodeMastodonStatusId, buildLocalAccount } from '$lib/server/mastodon-api';
import { isObjectFavourited } from '$lib/server/mastodon-state';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const objectId = decodeMastodonStatusId(event.params.id);
	if (!objectId) throw error(404, 'Unknown status');

	const favourited = await isObjectFavourited(event, objectId);
	return json(favourited ? [await buildLocalAccount(event)] : []);
}
