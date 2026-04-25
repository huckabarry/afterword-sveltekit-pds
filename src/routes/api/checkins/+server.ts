import { json } from '@sveltejs/kit';
import { getCheckinsApiPage } from '$lib/server/checkins-api';

export async function GET(event) {
	const page = await getCheckinsApiPage(event, {
		limit: event.url.searchParams.get('limit'),
		cursor: event.url.searchParams.get('cursor'),
		coordinatesOnly:
			event.url.searchParams.get('coordinatesOnly') || event.url.searchParams.get('map')
	});

	return json(page, {
		headers: {
			'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
		}
	});
}
