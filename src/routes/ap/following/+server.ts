import { activityJson, getActivityPubOrigin } from '$lib/server/activitypub';
import { listFollowing } from '$lib/server/activitypub-follows';

export async function GET(event) {
	const origin = getActivityPubOrigin(event);
	const following = await listFollowing(event);

	return activityJson({
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${origin}/ap/following`,
		type: 'OrderedCollection',
		totalItems: following.length,
		orderedItems: following.map((item) => item.actorId)
	});
}
