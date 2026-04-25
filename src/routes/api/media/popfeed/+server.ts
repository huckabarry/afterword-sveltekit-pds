import { json } from '@sveltejs/kit';
import { serializePopfeedItem } from '$lib/server/media-api';
import { getPopfeedItems, type PopfeedItemType } from '$lib/server/popfeed';

function normalizePopfeedType(value: string | null): PopfeedItemType | null {
	const normalized = String(value || '')
		.trim()
		.toLowerCase();

	switch (normalized) {
		case 'book':
		case 'movie':
		case 'tv_show':
			return normalized;
		default:
			return null;
	}
}

export async function GET(event) {
	const mediaType = normalizePopfeedType(event.url.searchParams.get('type'));
	const items = await getPopfeedItems();
	const filteredItems = mediaType ? items.filter((item) => item.type === mediaType) : items;

	return json(
		{
			items: filteredItems.map(serializePopfeedItem)
		},
		{
			headers: {
				'cache-control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=600'
			}
		}
	);
}
