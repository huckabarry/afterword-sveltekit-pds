import { attachGalleryAssetUrls, type GalleryPhotoItem } from '$lib/server/gallery-assets';
import { getPhotoItems } from '$lib/server/ghost';
import { getManifestGalleryPhotos } from '$lib/server/photo-manifest';

export const prerender = false;

export async function load(event) {
	const photos = await getPhotoItems();
	const localizedPhotos = await attachGalleryAssetUrls(photos, event.platform?.env.R2_BUCKET);
	const manifestPhotos = await getManifestGalleryPhotos(event);
	const manifestById = new Map(
		manifestPhotos.map((photo: GalleryPhotoItem) => [photo.id, photo] as const)
	);

	return {
		photos: localizedPhotos.map((photo) => ({
			...photo,
			...(manifestById.get(photo.id) || {})
		}))
	};
}
