import { attachGalleryAssetUrls, type GalleryPhotoItem } from '$lib/server/gallery-assets';
import { getPhotoItems } from '$lib/server/ghost';
import {
	getManifestGalleryPhotos,
	syncGalleryPhotoManifestForItems
} from '$lib/server/photo-manifest';

export const prerender = false;

export async function load(event) {
	const photos = await getPhotoItems();
	const localizedPhotos = await attachGalleryAssetUrls(photos, event.platform?.env.R2_BUCKET);
	const manifestPhotos = await getManifestGalleryPhotos(event);
	const manifestById = new Map<string, GalleryPhotoItem>(
		manifestPhotos.map((photo: GalleryPhotoItem) => [photo.id, photo] as const)
	);
	const photosNeedingHydration = photos.filter((photo) => {
		const manifestPhoto = manifestById.get(photo.id);
		return (
			!manifestPhoto ||
			!manifestPhoto.isSyncedToR2 ||
			!manifestPhoto.width ||
			!manifestPhoto.height
		);
	});

	if (photosNeedingHydration.length) {
		event.platform?.ctx.waitUntil(
			syncGalleryPhotoManifestForItems(event, photosNeedingHydration.slice(0, 24)).catch(() => {})
		);
	}

	return {
		photos: localizedPhotos.map((photo) => ({
			...photo,
			...(manifestById.get(photo.id) || {})
		}))
	};
}
