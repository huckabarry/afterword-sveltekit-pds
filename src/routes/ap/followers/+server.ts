import {
	activityJson,
	createEmptyOrderedCollection,
	getActivityPubOrigin,
	getFollowersId
} from '$lib/server/activitypub';

export async function GET(event) {
	const origin = getActivityPubOrigin(event);
	return activityJson(createEmptyOrderedCollection(getFollowersId(origin)));
}
