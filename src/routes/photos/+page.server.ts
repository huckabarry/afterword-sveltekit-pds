import { attachGalleryAssetUrls } from '$lib/server/gallery-assets';
import { getPhotoItems } from '$lib/server/ghost';

export const prerender = true;

export async function load(event) {
	let galleryBucket = null;

	try {
		galleryBucket = event.platform?.env?.R2_BUCKET ?? null;
	} catch {
		galleryBucket = null;
	}

	return {
		photos: await attachGalleryAssetUrls(await getPhotoItems(), galleryBucket)
	};
}
