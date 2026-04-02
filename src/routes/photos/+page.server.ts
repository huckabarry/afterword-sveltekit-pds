import { getGallerySnapshot } from '$lib/server/gallery-snapshot';

export const prerender = true;

export async function load(event) {
	return {
		photos: await getGallerySnapshot(event)
	};
}
