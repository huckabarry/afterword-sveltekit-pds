import {
	activityJson,
	createEmptyOrderedCollection,
	getActivityPubOrigin,
	getInboxId
} from '$lib/server/activitypub';

export function GET(event) {
	return activityJson(createEmptyOrderedCollection(getInboxId(getActivityPubOrigin(event))));
}

export async function POST() {
	return new Response(null, { status: 202 });
}
