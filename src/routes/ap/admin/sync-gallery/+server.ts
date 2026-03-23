import { requireDeliveryToken } from '$lib/server/activitypub-admin';
import { syncGalleryPhotosToR2 } from '$lib/server/gallery-assets';
import { getPhotoItems } from '$lib/server/ghost';
import { error } from '@sveltejs/kit';

export async function POST(event) {
	requireDeliveryToken(event.request);

	const bucket = event.platform?.env.R2_BUCKET;

	if (!bucket) {
		throw error(500, 'R2_BUCKET is not configured');
	}

	const photos = await getPhotoItems();
	const summary = await syncGalleryPhotosToR2(photos, bucket);

	return new Response(JSON.stringify(summary, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8'
		}
	});
}
