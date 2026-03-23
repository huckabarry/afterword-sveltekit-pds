import { activityJson, getActivityPubOrigin } from '$lib/server/activitypub';

export function GET(event) {
	const origin = getActivityPubOrigin(event);

	return activityJson({
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${origin}/ap/inbox`,
		type: 'OrderedCollection',
		totalItems: 0,
		orderedItems: []
	});
}

export function POST() {
	return new Response(
		JSON.stringify({
			error: 'Inbox delivery is not implemented yet.'
		}),
		{
			status: 501,
			headers: {
				'content-type': 'application/json; charset=utf-8'
			}
		}
	);
}

