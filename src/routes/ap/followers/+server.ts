import { activityJson, getActivityPubOrigin } from '$lib/server/activitypub';

export function GET(event) {
	const origin = getActivityPubOrigin(event);

	return activityJson({
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${origin}/ap/followers`,
		type: 'OrderedCollection',
		totalItems: 0,
		orderedItems: []
	});
}

