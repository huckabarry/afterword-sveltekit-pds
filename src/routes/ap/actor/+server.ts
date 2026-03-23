import { activityJson, createActor, getActivityPubOrigin } from '$lib/server/activitypub';
import { getSiteProfile } from '$lib/server/profile';

export async function GET(event) {
	return activityJson(createActor(getActivityPubOrigin(event), await getSiteProfile(event)));
}
