import { json } from '@sveltejs/kit';

export function GET(event) {
	const href = `${event.url.origin}/nodeinfo/2.0`;

	return json({
		links: [
			{
				rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
				href
			}
		]
	});
}
