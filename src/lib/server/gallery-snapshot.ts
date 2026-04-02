import type { RequestEvent } from '@sveltejs/kit';
import { attachGalleryAssetUrls, type GalleryPhotoItem } from '$lib/server/gallery-assets';
import { getPhotoItems } from '$lib/server/ghost';

const GALLERY_SNAPSHOT_TTL_MS = 1000 * 60 * 10;
const GALLERY_SNAPSHOT_R2_KEY = 'gallery/photos.json';

type GallerySnapshotContext = Pick<RequestEvent, 'platform'>;
type BoundR2Bucket = NonNullable<App.Platform['env']['R2_BUCKET']>;

type GallerySnapshotCacheEntry = {
	expiresAt: number;
	items: GalleryPhotoItem[];
};

function getGallerySnapshotScope() {
	const scope = globalThis as typeof globalThis & {
		__afterwordGallerySnapshotCache?: Map<string, GallerySnapshotCacheEntry>;
		__afterwordGallerySnapshotRefreshes?: Map<string, Promise<GalleryPhotoItem[]>>;
	};

	if (!scope.__afterwordGallerySnapshotCache) {
		scope.__afterwordGallerySnapshotCache = new Map<string, GallerySnapshotCacheEntry>();
	}

	if (!scope.__afterwordGallerySnapshotRefreshes) {
		scope.__afterwordGallerySnapshotRefreshes = new Map<string, Promise<GalleryPhotoItem[]>>();
	}

	return scope;
}

function getBucket(context?: GallerySnapshotContext) {
	try {
		return context?.platform?.env?.R2_BUCKET ?? null;
	} catch {
		return null;
	}
}

function getBucketCacheKey(bucket: BoundR2Bucket) {
	const name =
		typeof bucket === 'object' && bucket && 'name' in bucket ? String(bucket.name || '') : '';

	return name || 'default';
}

function serializeGalleryPhotos(items: GalleryPhotoItem[]) {
	return items.map((item) => ({
		...item,
		postPublishedAt: item.postPublishedAt.toISOString()
	}));
}

function deserializeGalleryPhotos(items: Array<Record<string, unknown>>) {
	return items.map((item) => ({
		...(item as unknown as Omit<GalleryPhotoItem, 'postPublishedAt'>),
		postPublishedAt: new Date(String(item.postPublishedAt || new Date().toISOString()))
	}));
}

async function readGallerySnapshotFromR2(bucket: BoundR2Bucket) {
	const object = await bucket.get(GALLERY_SNAPSHOT_R2_KEY);

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
		const items = (await object.json()) as Array<Record<string, unknown>>;

		if (!Array.isArray(items)) {
			return null;
		}

		return {
			generatedAt,
			items: deserializeGalleryPhotos(items)
		};
	} catch {
		return null;
	}
}

async function writeGallerySnapshotToR2(bucket: BoundR2Bucket, items: GalleryPhotoItem[]) {
	await bucket.put(GALLERY_SNAPSHOT_R2_KEY, JSON.stringify(serializeGalleryPhotos(items)), {
		customMetadata: {
			generatedAt: new Date().toISOString()
		},
		httpMetadata: {
			contentType: 'application/json; charset=utf-8'
		}
	});
}

function writeItemsToMemoryCache(cacheKey: string, items: GalleryPhotoItem[]) {
	getGallerySnapshotScope().__afterwordGallerySnapshotCache?.set(cacheKey, {
		expiresAt: Date.now() + GALLERY_SNAPSHOT_TTL_MS,
		items
	});
}

async function buildGallerySnapshotItems(context?: GallerySnapshotContext) {
	const bucket = getBucket(context);
	return attachGalleryAssetUrls(await getPhotoItems(), bucket);
}

async function rebuildGallerySnapshot(cacheKey: string, context?: GallerySnapshotContext) {
	const scope = getGallerySnapshotScope();
	const inflight = scope.__afterwordGallerySnapshotRefreshes?.get(cacheKey);

	if (inflight) {
		return inflight;
	}

	const refresh = (async () => {
		const items = await buildGallerySnapshotItems(context);

		writeItemsToMemoryCache(cacheKey, items);

		const bucket = getBucket(context);
		if (bucket) {
			try {
				await writeGallerySnapshotToR2(bucket, items);
			} catch {
				// Ignore snapshot write failures and keep the in-memory copy.
			}
		}

		return items;
	})();

	scope.__afterwordGallerySnapshotRefreshes?.set(cacheKey, refresh);

	try {
		return await refresh;
	} finally {
		scope.__afterwordGallerySnapshotRefreshes?.delete(cacheKey);
	}
}

export async function getGallerySnapshot(context?: GallerySnapshotContext) {
	const scope = getGallerySnapshotScope();
	const bucket = getBucket(context);
	const cacheKey = bucket ? getBucketCacheKey(bucket) : 'default';
	const cached = scope.__afterwordGallerySnapshotCache?.get(cacheKey);

	if (cached?.expiresAt && cached.expiresAt > Date.now()) {
		return cached.items;
	}

	if (cached?.items?.length) {
		context?.platform?.ctx?.waitUntil?.(rebuildGallerySnapshot(cacheKey, context).catch(() => {}));
		return cached.items;
	}

	if (bucket) {
		try {
			const snapshot = await readGallerySnapshotFromR2(bucket);
			const generatedAt = snapshot?.generatedAt ? Date.parse(snapshot.generatedAt) : NaN;

			if (snapshot) {
				writeItemsToMemoryCache(cacheKey, snapshot.items);

				if (
					!Number.isFinite(generatedAt) ||
					generatedAt + GALLERY_SNAPSHOT_TTL_MS <= Date.now()
				) {
					context?.platform?.ctx?.waitUntil?.(
						rebuildGallerySnapshot(cacheKey, context).catch(() => {})
					);
				}

				return snapshot.items;
			}
		} catch {
			// Fall through to a rebuild below.
		}
	}

	return rebuildGallerySnapshot(cacheKey, context);
}

export async function refreshGallerySnapshot(context?: GallerySnapshotContext) {
	const bucket = getBucket(context);
	const cacheKey = bucket ? getBucketCacheKey(bucket) : 'default';
	return rebuildGallerySnapshot(cacheKey, context);
}
