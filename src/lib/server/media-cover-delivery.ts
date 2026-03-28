import type { RequestEvent } from '@sveltejs/kit';
import type { MediaTimelineItem, MediaTimelinePage } from '$lib/types/media-timeline';

const MEDIA_COVER_PREFIX = 'timeline-covers/originals';

type MediaCoverPreset = 'mini' | 'cover';

function sanitizeSegment(value: string) {
	return (
		String(value || '')
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9._-]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'item'
	);
}

function inferExtensionFromUrl(imageUrl: string) {
	try {
		const pathname = new URL(imageUrl).pathname;
		const ext = pathname.split('.').pop()?.toLowerCase() || '';

		if (/^(avif|gif|jpe?g|png|svg|webp)$/i.test(ext)) {
			return ext === 'jpeg' ? 'jpg' : ext;
		}
	} catch {
		// ignore malformed URLs and fall through
	}

	return 'jpg';
}

function hashString(value: string) {
	let hash = 0x811c9dc5;

	for (const character of String(value || '')) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 0x01000193);
	}

	return (hash >>> 0).toString(36);
}

function isSameOriginOrRelativeUrl(imageUrl: string, origin: string) {
	const normalized = String(imageUrl || '').trim();

	if (!normalized) {
		return true;
	}

	if (normalized.startsWith('/')) {
		return true;
	}

	try {
		return new URL(normalized).origin === origin;
	} catch {
		return true;
	}
}

function getMediaCoverPreset(item: MediaTimelineItem): MediaCoverPreset | null {
	switch (item.kind) {
		case 'track':
			return 'mini';
		case 'album':
		case 'popfeed':
			return 'cover';
		default:
			return null;
	}
}

function getMediaCoverAssetKey(item: MediaTimelineItem, sourceUrl: string) {
	const extension = inferExtensionFromUrl(sourceUrl);
	return `${MEDIA_COVER_PREFIX}/${sanitizeSegment(item.kind)}/${sanitizeSegment(item.id)}-${hashString(sourceUrl)}.${extension}`;
}

function getMediaCoverVariantPath(key: string, preset: MediaCoverPreset, sourceUrl: string) {
	return `/${['media-cover-images', preset, ...key.split('/').filter(Boolean)].join('/')}?src=${encodeURIComponent(sourceUrl)}`;
}

export function attachMediaCoverDelivery(
	page: MediaTimelinePage,
	event: Pick<RequestEvent, 'platform' | 'url'>
): MediaTimelinePage {
	if (!event.platform?.env?.R2_BUCKET) {
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
