import { json } from '@sveltejs/kit';
import { getActorId, getActivityPubOrigin } from '$lib/server/activitypub';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import {
	buildRemoteAccount,
	decodeMastodonAccountId
} from '$lib/server/mastodon-api';
import { listFollowing } from '$lib/server/activitypub-follows';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const origin = getActivityPubOrigin(event);
	const localActorId = getActorId(origin);
	const actorId = decodeMastodonAccountId(event.params.id) || event.params.id;

	if (actorId !== localActorId) {
		return json([]);
	}

	const following = await listFollowing(event);
	const accounts = await Promise.all(
		following.map((item) => buildRemoteAccount(event, item.actorId).catch(() => null))
	);

	return json(accounts.filter(Boolean), {
		headers: {
			'cache-control': 'no-store'
		}
	});
}
