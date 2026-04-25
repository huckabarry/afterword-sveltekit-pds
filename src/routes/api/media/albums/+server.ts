import { json } from '@sveltejs/kit';
import { serializeAlbumEntry } from '$lib/server/media-api';
import { getAlbums } from '$lib/server/music';

export async function GET(event) {
	const items = await getAlbums(event);

	return json(
		{
			items: items.map(serializeAlbumEntry)
		},
		{
			headers: {
				'cache-control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=600'
			}
		}
	);
}
