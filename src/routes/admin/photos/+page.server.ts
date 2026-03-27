import { getGalleryManifestSummary } from '$lib/server/photo-manifest';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		summary: await getGalleryManifestSummary(event)
	};
};
