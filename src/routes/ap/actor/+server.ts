import { activityJson, createActor, getActivityPubOrigin } from '$lib/server/activitypub';

export function GET(event) {
	return activityJson(createActor(getActivityPubOrigin(event)));
}

