import type { RequestEvent } from '@sveltejs/kit';
import { getCheckins, type Checkin } from '$lib/server/atproto';
import { getSwarmSyncHealth, syncRecentSwarmCheckins } from '$lib/server/swarm';

const CHECKINS_SNAPSHOT_TTL_MS = 1000 * 60 * 5;
const CHECKINS_SNAPSHOT_R2_KEY = 'checkins/list.json';
const SWARM_CATCHUP_TTL_MS = 1000 * 60 * 10;
const SWARM_CATCHUP_STALE_MS = 1000 * 60 * 30;

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
		__afterwordSwarmCatchupRefreshes?: Map<string, Promise<void>>;
		__afterwordSwarmCatchupAttempts?: Map<string, number>;
	};

	if (!scope.__afterwordCheckinsSnapshotCache) {
		scope.__afterwordCheckinsSnapshotCache = new Map<string, CheckinsSnapshotCacheEntry>();
	}

	if (!scope.__afterwordCheckinsSnapshotRefreshes) {
		scope.__afterwordCheckinsSnapshotRefreshes = new Map<string, Promise<Checkin[]>>();
	}

	if (!scope.__afterwordSwarmCatchupRefreshes) {
		scope.__afterwordSwarmCatchupRefreshes = new Map<string, Promise<void>>();
	}

	if (!scope.__afterwordSwarmCatchupAttempts) {
		scope.__afterwordSwarmCatchupAttempts = new Map<string, number>();
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

function sortCheckins(items: Checkin[]) {
	return items
		.slice()
		.sort((left, right) => right.visitedAt.getTime() - left.visitedAt.getTime());
}

function mergeCheckins(existing: Checkin[], incoming: Checkin[]) {
	const merged = new Map<string, Checkin>();

	for (const item of existing) {
		merged.set(item.slug || item.id || item.uri, item);
	}

	for (const item of incoming) {
		merged.set(item.slug || item.id || item.uri, item);
	}

	return sortCheckins(Array.from(merged.values()));
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

function shouldTrySwarmCatchup(lastAttemptAt: number | undefined) {
	return !lastAttemptAt || lastAttemptAt + SWARM_CATCHUP_TTL_MS <= Date.now();
}

async function maybeRefreshFromSwarm(cacheKey: string, context?: CheckinsSnapshotContext) {
	if (!context?.platform?.ctx) {
		return;
	}

	const scope = getCheckinsSnapshotScope();
	const inflight = scope.__afterwordSwarmCatchupRefreshes?.get(cacheKey);

	if (inflight) {
		return;
	}

	const lastAttemptAt = scope.__afterwordSwarmCatchupAttempts?.get(cacheKey);
	if (!shouldTrySwarmCatchup(lastAttemptAt)) {
		return;
	}

	scope.__afterwordSwarmCatchupAttempts?.set(cacheKey, Date.now());

	const refresh = (async () => {
		const health = await getSwarmSyncHealth(context);

		if (!health.connected) {
			return;
		}

		const lastSyncedAt = health.lastSyncedAt ? Date.parse(health.lastSyncedAt) : NaN;
		if (Number.isFinite(lastSyncedAt) && lastSyncedAt + SWARM_CATCHUP_STALE_MS > Date.now()) {
			return;
		}

		await syncRecentSwarmCheckins(context, {
			limit: 5,
			includePhotos: false
		});
		await rebuildCheckinsSnapshot(cacheKey, context);
	})().catch((syncError) => {
		console.warn('[checkins] Swarm catch-up failed:', syncError);
	});

	scope.__afterwordSwarmCatchupRefreshes?.set(cacheKey, refresh);
	context.platform.ctx.waitUntil(refresh);

	try {
		await refresh;
	} finally {
		scope.__afterwordSwarmCatchupRefreshes?.delete(cacheKey);
	}
}

export async function getCheckinsSnapshot(context?: CheckinsSnapshotContext) {
	const scope = getCheckinsSnapshotScope();
	const bucket = getBucket(context);
	const cacheKey = bucket ? getBucketCacheKey(bucket) : 'default';
	const cached = scope.__afterwordCheckinsSnapshotCache?.get(cacheKey);

	if (cached?.expiresAt && cached.expiresAt > Date.now()) {
		await maybeRefreshFromSwarm(cacheKey, context);
		return scope.__afterwordCheckinsSnapshotCache?.get(cacheKey)?.items || cached.items;
	}

	if (cached?.items?.length) {
		context?.platform?.ctx?.waitUntil?.(rebuildCheckinsSnapshot(cacheKey, context).catch(() => {}));
		await maybeRefreshFromSwarm(cacheKey, context);
		return scope.__afterwordCheckinsSnapshotCache?.get(cacheKey)?.items || cached.items;
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

				await maybeRefreshFromSwarm(cacheKey, context);

				return scope.__afterwordCheckinsSnapshotCache?.get(cacheKey)?.items || snapshot.items;
			}
		} catch {
			// Fall through to live rebuild below.
		}
	}

	await maybeRefreshFromSwarm(cacheKey, context);
	return rebuildCheckinsSnapshot(cacheKey, context);
}

export async function refreshCheckinsSnapshot(context?: CheckinsSnapshotContext) {
	const bucket = getBucket(context);
	const cacheKey = bucket ? getBucketCacheKey(bucket) : 'default';
	return rebuildCheckinsSnapshot(cacheKey, context);
}

export async function mergeIntoCheckinsSnapshot(
	context: CheckinsSnapshotContext | undefined,
	incoming: Checkin[]
) {
	if (!incoming.length) {
		return [];
	}

	const scope = getCheckinsSnapshotScope();
	const bucket = getBucket(context);
	const cacheKey = bucket ? getBucketCacheKey(bucket) : 'default';
	const cached = scope.__afterwordCheckinsSnapshotCache?.get(cacheKey);

	let baseItems = cached?.items || [];

	if (!baseItems.length && bucket) {
		try {
			const snapshot = await readCheckinsSnapshotFromR2(bucket);
			baseItems = snapshot?.items || [];
		} catch {
			baseItems = [];
		}
	}

	const merged = mergeCheckins(baseItems, incoming);
	writeItemsToMemoryCache(cacheKey, merged);

	if (bucket) {
		try {
			await writeCheckinsSnapshotToR2(bucket, merged);
		} catch {
			// Keep the in-memory snapshot even if the R2 write fails.
		}
	}

	return merged;
}
