import {
	getActivityPubOrigin,
	getActorAliases,
	getActorId,
	getPreferredUsername,
	jrdJson
} from '$lib/server/activitypub';

export function GET(event) {
	const origin = getActivityPubOrigin(event);
	const actorId = getActorId(origin);
	const resource = event.url.searchParams.get('resource') || '';
	const aliases = getActorAliases(origin);

	if (resource && !aliases.includes(resource)) {
		return jrdJson(
			{
				error: 'Resource not found'
			},
			{ status: 404 }
		);
	}

	return jrdJson({
		subject: aliases[0],
		aliases: [`${origin}/about`],
		links: [
			{
				rel: 'self',
				type: 'application/activity+json',
				href: actorId
			},
			{
				rel: 'http://webfinger.net/rel/profile-page',
				type: 'text/html',
				href: `${origin}/about`
			},
			{
				rel: 'alternate',
				type: 'text/html',
				href: `${origin}/about`
			}
		],
		properties: {
			'https://www.w3.org/ns/activitystreams#type': 'Person',
			'https://www.w3.org/ns/activitystreams#name': 'Bryan Robb',
			'https://www.w3.org/ns/activitystreams#preferredUsername': getPreferredUsername()
		}
	});
}
