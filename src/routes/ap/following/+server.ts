import {
	activityJson,
	createEmptyOrderedCollection,
	getActivityPubOrigin,
	getFollowingId
} from '$lib/server/activitypub';

export async function GET(event) {
	const origin = getActivityPubOrigin(event);
	return activityJson(createEmptyOrderedCollection(getFollowingId(origin)));
}
