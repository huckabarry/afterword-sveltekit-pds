import { getGalleryManifestSummary, getPagedManifestGalleryPhotos } from '$lib/server/photo-manifest';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const pageParam = Number.parseInt(event.url.searchParams.get('page') || '1', 10);
	const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
	const paged = await getPagedManifestGalleryPhotos(event, {
		page,
		limit: 48
	});

	return {
		summary: await getGalleryManifestSummary(event),
		photos: paged.photos,
		pagination: {
			page: paged.page,
			limit: paged.limit,
			total: paged.total,
			totalPages: paged.totalPages
		}
	};
};
