import { error } from '@sveltejs/kit';
import { activityJson, getActivityObjectBySlug, getActivityPubOrigin } from '$lib/server/activitypub';

export async function GET(event) {
	const object = await getActivityObjectBySlug(event.params.slug, getActivityPubOrigin(event));

	if (!object) {
		throw error(404, 'ActivityPub object not found');
	}

	return activityJson(object);
}

