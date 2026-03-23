import { activityJson, getActivityPubOrigin, getFollowersId } from '$lib/server/activitypub';
import { listFollowers } from '$lib/server/followers';

export async function GET(event) {
	const origin = getActivityPubOrigin(event);
	const followers = await listFollowers(event);

	return activityJson({
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: getFollowersId(origin),
		type: 'OrderedCollection',
		totalItems: followers.length,
		orderedItems: followers.map((follower) => follower.actorId)
	});
}
