import type { RequestEvent } from '@sveltejs/kit';
import { getCheckins, type Checkin } from '$lib/server/atproto';

const CHECKINS_SNAPSHOT_TTL_MS = 1000 * 60 * 5;
const CHECKINS_SNAPSHOT_R2_KEY = 'checkins/list.json';

type CheckinsSnapshotContext = Pick<RequestEvent, 'platform'>;
type BoundR2Bucket = NonNullable<App.Platform['env']['R2_BUCKET']>;

type CheckinsSnapshotCacheEntry = {
	expiresAt: number;
	items: Checkin[];
};

function getCheckinsSnapshotScope() {
	const scope = globalThis as typeof globalThis & {
		__afterwordCheckinsSnapshotCache?: Map<string, CheckinsSnapshotCacheEntry>;
		__afterwordCheckinsSnapshotRefreshes?: Map<string, Promise<Checkin[]>>;
	};

	if (!scope.__afterwordCheckinsSnapshotCache) {
		scope.__afterwordCheckinsSnapshotCache = new Map<string, CheckinsSnapshotCacheEntry>();
	}

	if (!scope.__afterwordCheckinsSnapshotRefreshes) {
		scope.__afterwordCheckinsSnapshotRefreshes = new Map<string, Promise<Checkin[]>>();
	}

	return scope;
}

function getBucket(context?: CheckinsSnapshotContext) {
	return context?.platform?.env?.R2_BUCKET ?? null;
}

function getBucketCacheKey(bucket: BoundR2Bucket) {
	const name =
		typeof bucket === 'object' && bucket && 'name' in bucket ? String(bucket.name || '') : '';

	return name || 'default';
}

function serializeCheckins(items: Checkin[]) {
	return items.map((item) => ({
		...item,
		createdAt: item.createdAt.toISOString(),
		visitedAt: item.visitedAt.toISOString()
	}));
}

function deserializeCheckins(items: Array<Record<string, unknown>>) {
	return items.map((item) => ({
		...(item as unknown as Omit<Checkin, 'createdAt' | 'visitedAt'>),
		createdAt: new Date(String(item.createdAt || new Date().toISOString())),
		visitedAt: new Date(String(item.visitedAt || new Date().toISOString()))
	}));
}

async function readCheckinsSnapshotFromR2(bucket: BoundR2Bucket) {
	const object = await bucket.get(CHECKINS_SNAPSHOT_R2_KEY);

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
			items: deserializeCheckins(items)
		};
	} catch {
		return null;
	}
}

async function writeCheckinsSnapshotToR2(bucket: BoundR2Bucket, items: Checkin[]) {
	await bucket.put(CHECKINS_SNAPSHOT_R2_KEY, JSON.stringify(serializeCheckins(items)), {
		customMetadata: {
			generatedAt: new Date().toISOString()
		},
		httpMetadata: {
			contentType: 'application/json; charset=utf-8'
		}
	});
}

function writeItemsToMemoryCache(cacheKey: string, items: Checkin[]) {
	const scope = getCheckinsSnapshotScope();
	scope.__afterwordCheckinsSnapshotCache?.set(cacheKey, {
		expiresAt: Date.now() + CHECKINS_SNAPSHOT_TTL_MS,
		items
	});
}

async function rebuildCheckinsSnapshot(cacheKey: string, context?: CheckinsSnapshotContext) {
	const scope = getCheckinsSnapshotScope();
	const inflight = scope.__afterwordCheckinsSnapshotRefreshes?.get(cacheKey);

	if (inflight) {
		return inflight;
	}

	const refresh = (async () => {
		const items = await getCheckins();

		writeItemsToMemoryCache(cacheKey, items);

		const bucket = getBucket(context);
		if (bucket) {
			try {
				await writeCheckinsSnapshotToR2(bucket, items);
			} catch {
				// Ignore snapshot write failures and keep the in-memory copy.
			}
		}

		return items;
	})();

	scope.__afterwordCheckinsSnapshotRefreshes?.set(cacheKey, refresh);

	try {
		return await refresh;
	} finally {
		scope.__afterwordCheckinsSnapshotRefreshes?.delete(cacheKey);
	}
}

export async function getCheckinsSnapshot(context?: CheckinsSnapshotContext) {
	const scope = getCheckinsSnapshotScope();
	const bucket = getBucket(context);
	const cacheKey = bucket ? getBucketCacheKey(bucket) : 'default';
	const cached = scope.__afterwordCheckinsSnapshotCache?.get(cacheKey);

	if (cached?.expiresAt && cached.expiresAt > Date.now()) {
		return cached.items;
	}

	if (cached?.items?.length) {
		context?.platform?.ctx?.waitUntil?.(rebuildCheckinsSnapshot(cacheKey, context).catch(() => {}));
		return cached.items;
	}

	if (bucket) {
		try {
			const snapshot = await readCheckinsSnapshotFromR2(bucket);
			const generatedAt = snapshot?.generatedAt ? Date.parse(snapshot.generatedAt) : NaN;

			if (snapshot) {
				writeItemsToMemoryCache(cacheKey, snapshot.items);

				if (
					!Number.isFinite(generatedAt) ||
					generatedAt + CHECKINS_SNAPSHOT_TTL_MS <= Date.now()
				) {
					context?.platform?.ctx?.waitUntil?.(
						rebuildCheckinsSnapshot(cacheKey, context).catch(() => {})
					);
				}

				return snapshot.items;
			}
		} catch {
			// Fall through to live rebuild below.
		}
	}

	return rebuildCheckinsSnapshot(cacheKey, context);
}

export async function refreshCheckinsSnapshot(context?: CheckinsSnapshotContext) {
	const bucket = getBucket(context);
	const cacheKey = bucket ? getBucketCacheKey(bucket) : 'default';
	return rebuildCheckinsSnapshot(cacheKey, context);
}
