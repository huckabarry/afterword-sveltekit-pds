import { requireDeliveryToken } from '$lib/server/activitypub-admin';
import { syncSearchIndex } from '$lib/server/search';

export async function POST(event) {
	requireDeliveryToken(event.request);

	const summary = await syncSearchIndex(event);

	return new Response(JSON.stringify(summary, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8'
		}
	});
}
