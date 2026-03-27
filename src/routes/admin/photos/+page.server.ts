import { getGalleryManifestSummary, getRecentManifestGalleryPhotos } from '$lib/server/photo-manifest';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		summary: await getGalleryManifestSummary(event),
		recentPhotos: await getRecentManifestGalleryPhotos(event, 18)
	};
};
