import { getPhotoItems } from '$lib/server/ghost';

export const prerender = false;

export async function load() {
	return {
		photos: await getPhotoItems()
	};
}
