import { attachGalleryAssetUrls } from '$lib/server/gallery-assets';
import { getPhotoItems } from '$lib/server/ghost';
import { getManifestGalleryPhotos } from '$lib/server/photo-manifest';

export const prerender = false;

export async function load(event) {
	const manifestPhotos = await getManifestGalleryPhotos(event);

	if (manifestPhotos.length) {
		return {
			photos: manifestPhotos
		};
	}

	const photos = await getPhotoItems();

	return {
		photos: await attachGalleryAssetUrls(photos, event.platform?.env.R2_BUCKET)
	};
}
