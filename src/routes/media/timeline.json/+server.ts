import { json } from '@sveltejs/kit';
import { attachMediaCoverDelivery } from '$lib/server/media-cover-delivery';
import { getFilteredMediaTimelinePage, MEDIA_TIMELINE_PAGE_SIZE } from '$lib/server/media-timeline';
import type { MediaTimelineKind, MediaTimelineMediaType } from '$lib/types/media-timeline';

function normalizeNumber(value: string | null, fallback: number) {
	const parsed = Number.parseInt(String(value || ''), 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeKinds(values: string[]): MediaTimelineKind[] {
	return Array.from(
		new Set(
			values
				.flatMap((value) => String(value || '').split(','))
				.map((value) => value.trim().toLowerCase())
				.filter(
					(value): value is MediaTimelineKind =>
						value === 'track' || value === 'album' || value === 'popfeed'
				)
		)
	);
}

function normalizeMediaTypes(values: string[]): MediaTimelineMediaType[] {
	return Array.from(
		new Set(
			values
				.flatMap((value) => String(value || '').split(','))
				.map((value) => value.trim().toLowerCase())
				.filter(
					(value): value is MediaTimelineMediaType =>
						value === 'book' || value === 'movie' || value === 'tv_show'
				)
		)
	);
}

export async function GET(event) {
	const offset = normalizeNumber(event.url.searchParams.get('offset'), 0);
	const limit = normalizeNumber(event.url.searchParams.get('limit'), MEDIA_TIMELINE_PAGE_SIZE);
	const kinds = normalizeKinds(event.url.searchParams.getAll('kind'));
	const mediaTypes = normalizeMediaTypes(event.url.searchParams.getAll('mediaType'));

	const page = await getFilteredMediaTimelinePage(event, {
		offset,
		limit,
		filters: {
			kinds,
			mediaTypes
		}
	});

	return json(attachMediaCoverDelivery(page, event), {
		headers: {
			'cache-control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=300'
		}
	});
}
