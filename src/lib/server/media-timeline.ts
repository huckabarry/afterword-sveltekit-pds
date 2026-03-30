import type { RequestEvent } from '@sveltejs/kit';
import { getAlbums, getTracks } from '$lib/server/music';
import { getPopfeedItems } from '$lib/server/popfeed';
import type {
	AlbumTimelineItem,
	MediaTimelineItem,
	MediaTimelinePage,
	PopfeedTimelineItem,
	TimelineLink,
	TrackTimelineItem
} from '$lib/types/media-timeline';
const MEDIA_TIMELINE_CACHE_TTL_MS = 1000 * 60 * 5;
export const MEDIA_TIMELINE_PAGE_SIZE = 20;
const MEDIA_TIMELINE_R2_KEY = 'media/timeline.json';

type MediaTimelineCacheEntry = {
	expiresAt: number;
	items: MediaTimelineItem[];
};

type BoundR2Bucket = NonNullable<App.Platform['env']['R2_BUCKET']>;

function getTimelineCache() {
	const scope = globalThis as typeof globalThis & {
		__afterwordMediaTimelineCache?: Map<string, MediaTimelineCacheEntry>;
		__afterwordMediaTimelineRefreshes?: Map<string, Promise<MediaTimelineItem[]>>;
	};

	if (!scope.__afterwordMediaTimelineCache) {
		scope.__afterwordMediaTimelineCache = new Map<string, MediaTimelineCacheEntry>();
	}

	if (!scope.__afterwordMediaTimelineRefreshes) {
		scope.__afterwordMediaTimelineRefreshes = new Map<string, Promise<MediaTimelineItem[]>>();
	}

	return scope;
}

function getBucket(context?: MediaTimelineContext) {
	return context?.platform?.env?.R2_BUCKET ?? null;
}

function getBucketCacheKey(bucket: BoundR2Bucket) {
	const name =
		typeof bucket === 'object' && bucket && 'name' in bucket ? String(bucket.name || '') : 'default';

	return name || 'default';
}

function stripHtml(value: string) {
	return String(value || '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function summarize(value: string, maxLength = 220) {
	const text = stripHtml(value);

	if (!text || text.length <= maxLength) {
		return text;
	}

	const clipped = text.slice(0, maxLength).replace(/\s+\S*$/, '');
	return `${clipped}…`;
}

function formatTimelineDate(value: Date) {
	const date = value instanceof Date ? value : new Date(value);
	const currentYear = new Date().getFullYear();

	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		...(date.getFullYear() !== currentYear ? { year: 'numeric' as const } : {})
	}).format(date);
}

function toTimelineLinks(links: Array<{ label: string; url: string }>, limit = 3): TimelineLink[] {
	return (links || []).slice(0, limit).map((link) => ({
		label: link.label,
		url: link.url,
		external: true
	}));
}

function toTrackTimelineItem(
	track: Awaited<ReturnType<typeof getTracks>>[number]
): TrackTimelineItem {
	return {
		id: `track-${track.slug}`,
		kind: 'track',
		label: 'Listening',
		title: track.trackTitle,
		href: track.localPath,
		dateIso: track.publishedAt.toISOString(),
		dateLabel: formatTimelineDate(track.publishedAt),
		summary: summarize(track.note || ''),
		imageUrl: track.artworkUrl || null,
		imageAlt: `${track.trackTitle} by ${track.artist}`,
		tags: [],
		artist: track.artist,
		audioUrl: track.previewUrl || null,
		links: toTimelineLinks(track.listenLinks)
	};
}

function toAlbumTimelineItem(
	album: Awaited<ReturnType<typeof getAlbums>>[number]
): AlbumTimelineItem {
	return {
		id: `album-${album.slug}`,
		kind: 'album',
		label: 'Album Rotation',
		title: album.albumTitle,
		href: album.localPath,
		dateIso: album.publishedAt.toISOString(),
		dateLabel: formatTimelineDate(album.publishedAt),
		summary: summarize(album.note || ''),
		imageUrl: album.coverImage || null,
		imageAlt: `${album.albumTitle} by ${album.artist}`,
		tags: [],
		artist: album.artist,
		links: toTimelineLinks(album.listenLinks)
	};
}

function getPopfeedLabel(item: Awaited<ReturnType<typeof getPopfeedItems>>[number]) {
	switch (item.type) {
		case 'book':
			return 'Book';
		case 'tv_show':
			return 'Show';
		default:
			return 'Movie';
	}
}

function toPopfeedTimelineItem(
	item: Awaited<ReturnType<typeof getPopfeedItems>>[number]
): PopfeedTimelineItem {
	return {
		id: `popfeed-${item.type}-${item.slug}`,
		kind: 'popfeed',
		label: getPopfeedLabel(item),
		title: item.title,
		href: item.localPath,
		dateIso: item.date.toISOString(),
		dateLabel: formatTimelineDate(item.date),
		summary: item.genres.slice(0, 4).join(', '),
		imageUrl: item.posterImage,
		fallbackImageUrl: null,
		imageAlt: item.mainCredit ? `${item.title} by ${item.mainCredit}` : item.title,
		tags: item.listTypeLabel ? [item.listTypeLabel] : [],
		credit: item.mainCredit,
		links: toTimelineLinks(item.links),
		mediaType: item.type,
		statusLabel: item.listTypeLabel,
		activityLabel: item.activityLabel
	};
}

type MediaTimelineContext = Pick<RequestEvent, 'platform' | 'url'> | null | undefined;

async function buildAllMediaTimelineItems(context?: MediaTimelineContext) {
	const [albums, tracks, popfeedItems] = await Promise.all([
		getAlbums(context),
		getTracks(context),
		getPopfeedItems()
	]);
	const items = [
		...tracks.map(toTrackTimelineItem),
		...albums.map(toAlbumTimelineItem),
		...popfeedItems.map(toPopfeedTimelineItem)
	].sort((left, right) => Date.parse(right.dateIso) - Date.parse(left.dateIso));

	return items;
}

function writeItemsToMemoryCache(cacheKey: string, items: MediaTimelineItem[]) {
	getTimelineCache().__afterwordMediaTimelineCache?.set(cacheKey, {
		expiresAt: Date.now() + MEDIA_TIMELINE_CACHE_TTL_MS,
		items
	});
}

async function rebuildMediaTimelineItems(
	cacheKey: string,
	context?: MediaTimelineContext
) {
	const scope = getTimelineCache();
	const existingRefresh = scope.__afterwordMediaTimelineRefreshes?.get(cacheKey);

	if (existingRefresh) {
		return existingRefresh;
	}

	const refresh = (async () => {
		const items = await buildAllMediaTimelineItems(context);
		writeItemsToMemoryCache(cacheKey, items);

		const bucket = getBucket(context);
		if (bucket) {
			await writeTimelineSnapshotToR2(bucket, items);
		}

		return items;
	})()
		.catch((error) => {
			throw error;
		})
		.finally(() => {
			scope.__afterwordMediaTimelineRefreshes?.delete(cacheKey);
		});

	scope.__afterwordMediaTimelineRefreshes?.set(cacheKey, refresh);
	return refresh;
}

async function readTimelineSnapshotFromR2(bucket: BoundR2Bucket) {
	const object = await bucket.get(MEDIA_TIMELINE_R2_KEY);

	if (!object) {
		return null;
	}

	try {
		const generatedAt =
			String(
				(typeof object === 'object' &&
					object &&
					'customMetadata' in object &&
					(object.customMetadata as Record<string, string | undefined>)?.generatedAt) ||
					object.uploaded?.toISOString?.() ||
					''
			).trim() || null;
		const items = (await object.json()) as MediaTimelineItem[];

		if (!Array.isArray(items)) {
			return null;
		}

		return { generatedAt, items };
	} catch {
		return null;
	}
}

async function writeTimelineSnapshotToR2(bucket: BoundR2Bucket, items: MediaTimelineItem[]) {
	await bucket.put(MEDIA_TIMELINE_R2_KEY, JSON.stringify(items), {
		customMetadata: {
			generatedAt: new Date().toISOString()
		},
		httpMetadata: {
			contentType: 'application/json; charset=utf-8'
		}
	});
}

async function getAllMediaTimelineItems(context?: MediaTimelineContext) {
	const scope = getTimelineCache();
	const bucket = getBucket(context);
	const cacheKey = bucket ? getBucketCacheKey(bucket) : 'default';
	const cached = scope.__afterwordMediaTimelineCache?.get(cacheKey);

	if (cached?.expiresAt && cached.expiresAt > Date.now()) {
		return cached.items;
	}

	if (cached?.items?.length) {
		context?.platform?.ctx?.waitUntil?.(rebuildMediaTimelineItems(cacheKey, context).catch(() => {}));
		return cached.items;
	}

	if (bucket) {
		try {
			const snapshot = await readTimelineSnapshotFromR2(bucket);
			const generatedAt = snapshot?.generatedAt ? Date.parse(snapshot.generatedAt) : NaN;

			if (snapshot) {
				writeItemsToMemoryCache(cacheKey, snapshot.items);

				if (
					!Number.isFinite(generatedAt) ||
					generatedAt + MEDIA_TIMELINE_CACHE_TTL_MS <= Date.now()
				) {
					context?.platform?.ctx?.waitUntil?.(
						rebuildMediaTimelineItems(cacheKey, context).catch(() => {})
					);
				}

				return snapshot.items;
			}
		} catch {
			// Fall through to a live rebuild below.
		}
	}

	return rebuildMediaTimelineItems(cacheKey, context);
}

export async function getMediaTimelinePage(
	context?: MediaTimelineContext,
	offset = 0,
	limit = MEDIA_TIMELINE_PAGE_SIZE
): Promise<MediaTimelinePage> {
	const items = await getAllMediaTimelineItems(context);
	const safeLimit = Math.max(1, Math.min(limit, 40));
	const safeOffset = Math.max(0, offset);
	const pageItems = items.slice(safeOffset, safeOffset + safeLimit);
	const nextOffset = safeOffset + safeLimit < items.length ? safeOffset + safeLimit : null;

	return {
		items: pageItems,
		offset: safeOffset,
		limit: safeLimit,
		total: items.length,
		nextOffset
	};
}
