import {
	activityJson,
	createEmptyOrderedCollection,
	getActivityPubOrigin,
	getOutboxId
} from '$lib/server/activitypub';

export async function GET(event) {
	return activityJson(createEmptyOrderedCollection(getOutboxId(getActivityPubOrigin(event))));
}
