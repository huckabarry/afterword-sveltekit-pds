import { attachGalleryAssetUrls } from '$lib/server/gallery-assets';
import { getPhotoItems } from '$lib/server/ghost';

export const prerender = false;

export async function load({ platform }) {
	const photos = await getPhotoItems();

	return {
		photos: await attachGalleryAssetUrls(photos, platform?.env.R2_BUCKET)
	};
}
