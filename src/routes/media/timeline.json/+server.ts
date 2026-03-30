import { json } from '@sveltejs/kit';
import { attachMediaCoverDelivery } from '$lib/server/media-cover-delivery';
import { getMediaTimelinePage, MEDIA_TIMELINE_PAGE_SIZE } from '$lib/server/media-timeline';

function normalizeNumber(value: string | null, fallback: number) {
	const parsed = Number.parseInt(String(value || ''), 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(event) {
	const offset = normalizeNumber(event.url.searchParams.get('offset'), 0);
	const limit = normalizeNumber(event.url.searchParams.get('limit'), MEDIA_TIMELINE_PAGE_SIZE);

	const page = await getMediaTimelinePage(event, offset, limit);

	return json(attachMediaCoverDelivery(page, event));
}
