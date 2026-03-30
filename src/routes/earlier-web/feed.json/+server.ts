import { json } from '@sveltejs/kit';
import {
	EARLIER_WEB_STREAM_PAGE_SIZE,
	getEarlierWebStreamHydratedPage
} from '$lib/server/earlier-web';

export async function GET(event) {
	const cursor = String(event.url.searchParams.get('cursor') || '').trim() || null;
	const limitParam = Number.parseInt(String(event.url.searchParams.get('limit') || ''), 10);
	const limit = Number.isInteger(limitParam) ? limitParam : EARLIER_WEB_STREAM_PAGE_SIZE;
	const page = await getEarlierWebStreamHydratedPage(event, { cursor, limit });

	return json(page, {
		headers: {
			'cache-control': 'public, max-age=60'
		}
	});
}
