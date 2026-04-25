import { json } from '@sveltejs/kit';
import { serializeTrackEntry } from '$lib/server/media-api';
import { getTracks } from '$lib/server/music';

export async function GET(event) {
	const items = await getTracks(event);

	return json(
		{
			items: items.map(serializeTrackEntry)
		},
		{
			headers: {
				'cache-control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=600'
			}
		}
	);
}
