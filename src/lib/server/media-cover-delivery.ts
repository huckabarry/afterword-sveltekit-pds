import type { RequestEvent } from '@sveltejs/kit';
import type { MediaTimelineItem, MediaTimelinePage } from '$lib/types/media-timeline';
import {
	buildVariantPath,
	hashString,
	inferImageExtensionFromUrl,
	isSameOriginOrRelativeUrl,
	sanitizeAssetSegment
} from '$lib/server/image-delivery';

const MEDIA_COVER_PREFIX = 'timeline-covers/originals';

type MediaCoverPreset = 'mini' | 'cover';

function getMediaCoverPreset(item: MediaTimelineItem): MediaCoverPreset | null {
	switch (item.kind) {
		case 'track':
			return 'mini';
		case 'album':
			return 'cover';
		case 'popfeed':
			return item.mediaType === 'book' ? null : 'cover';
		default:
			return null;
	}
}

function getMediaCoverAssetKey(item: MediaTimelineItem, sourceUrl: string) {
	const extension = inferImageExtensionFromUrl(sourceUrl);
	return `${MEDIA_COVER_PREFIX}/${sanitizeAssetSegment(item.kind)}/${sanitizeAssetSegment(item.id)}-${hashString(sourceUrl)}.${extension}`;
}

function getMediaCoverVariantPath(key: string, preset: MediaCoverPreset, sourceUrl: string) {
	return buildVariantPath('media-cover-images', preset, key, sourceUrl);
}

export function attachMediaCoverDelivery(
	page: MediaTimelinePage,
	event: Pick<RequestEvent, 'platform' | 'url'>
): MediaTimelinePage {
	try {
		if (!event.platform?.env?.R2_BUCKET) {
			return page;
		}
	} catch {
		return page;
	}

	return {
		...page,
		items: page.items.map((item) => {
			const sourceUrl = String(item.imageUrl || '').trim();
			const preset = getMediaCoverPreset(item);

			if (!sourceUrl || !preset || isSameOriginOrRelativeUrl(sourceUrl, event.url.origin)) {
				return item;
			}

			const key = getMediaCoverAssetKey(item, sourceUrl);

			return {
				...item,
				imageUrl: getMediaCoverVariantPath(key, preset, sourceUrl),
				fallbackImageUrl: item.fallbackImageUrl || sourceUrl
			};
		})
	};
}
