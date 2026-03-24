import { json } from '@sveltejs/kit';
import { listBookmarkedObjectIds } from '$lib/server/mastodon-state';
import { resolveStatusByObjectId } from '$lib/server/mastodon-api';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';

export async function GET(event) {
	await requireMastodonAccessToken(event);
	const objectIds = await listBookmarkedObjectIds(event, 80);
	return json(
		(await Promise.all(objectIds.map((objectId: string) => resolveStatusByObjectId(event, objectId)))).filter(Boolean)
	);
}
