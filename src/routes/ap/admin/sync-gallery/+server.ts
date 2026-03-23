import { requireDeliveryToken } from '$lib/server/activitypub-admin';
import { syncGalleryPhotosToR2 } from '$lib/server/gallery-assets';
import { getPhotoItems } from '$lib/server/ghost';
import { error } from '@sveltejs/kit';

function getBatchParams(request: Request) {
	const url = new URL(request.url);
	const rawOffset = url.searchParams.get('offset');
	const rawLimit = url.searchParams.get('limit');
	const parsedOffset = Number.parseInt(String(rawOffset || '0'), 10);
	const parsedLimit = Number.parseInt(String(rawLimit || '25'), 10);

	return {
		offset: Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0,
		limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 25
	};
}

export async function POST(event) {
	requireDeliveryToken(event.request);

	const bucket = event.platform?.env.R2_BUCKET;

	if (!bucket) {
		throw error(500, 'R2_BUCKET is not configured');
	}

	const allPhotos = await getPhotoItems();
	const { offset, limit } = getBatchParams(event.request);
	const photos = allPhotos.slice(offset, offset + limit);
	const summary = await syncGalleryPhotosToR2(photos, bucket);

	return new Response(
		JSON.stringify(
			{
				totalAvailable: allPhotos.length,
				offset,
				limit,
				...summary,
				nextOffset: offset + photos.length < allPhotos.length ? offset + photos.length : null
			},
			null,
			2
		),
		{
		headers: {
			'content-type': 'application/json; charset=utf-8'
		}
		}
	);
}
