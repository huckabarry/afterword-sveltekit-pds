import { error } from '@sveltejs/kit';
import { activityJson, getActivityPubOrigin, getStatusActivityObjectBySlug } from '$lib/server/activitypub';

export async function GET(event) {
	const object = await getStatusActivityObjectBySlug(event.params.slug, getActivityPubOrigin(event));

	if (!object) {
		throw error(404, 'Status not found');
	}

	return activityJson(object);
}
