import { json } from '@sveltejs/kit';
import { getGallerySnapshot } from '$lib/server/gallery-snapshot';

export const prerender = true;

function getGalleryVariantUrl(url: string, preset: 'thumb-sm' | 'thumb-md' | 'thumb') {
	return String(url || '').replace(/\/gallery-images\/[^/]+\//, `/gallery-images/${preset}/`);
}

export async function GET(event) {
	const photos = await getGallerySnapshot(event);
	const urls = photos.slice(0, 9).flatMap((photo) => {
		const displayUrl = String(photo.displayUrl || '').trim();

		if (!displayUrl) {
			return [];
		}

		if (!displayUrl.includes('/gallery-images/')) {
			return [displayUrl];
		}

		return [getGalleryVariantUrl(displayUrl, 'thumb-sm'), getGalleryVariantUrl(displayUrl, 'thumb-md')];
	});

	return json(
		{ urls },
		{
			headers: {
				'cache-control': 'public, max-age=3600, immutable'
			}
		}
	);
}
