import { getStatusPage, STATUS_PAGE_SIZE, type StatusFeedPage } from '$lib/server/atproto';

const STATUS_SNAPSHOT_TTL_MS = 1000 * 60 * 4;
const STATUS_SNAPSHOT_R2_KEY = 'status/page-1.json';

type StatusSnapshotContext = {
	platform?: App.Platform;
};

type StatusSnapshotCacheEntry = {
	expiresAt: number;
	page: StatusFeedPage;
};

type BoundR2Bucket = NonNullable<App.Platform['env']['R2_BUCKET']>;

function getStatusSnapshotScope() {
	const scope = globalThis as typeof globalThis & {
		__afterwordStatusSnapshotCache?: Map<string, StatusSnapshotCacheEntry>;
		__afterwordStatusSnapshotRefreshes?: Map<string, Promise<StatusFeedPage>>;
	};

	if (!scope.__afterwordStatusSnapshotCache) {
		scope.__afterwordStatusSnapshotCache = new Map<string, StatusSnapshotCacheEntry>();
	}

	if (!scope.__afterwordStatusSnapshotRefreshes) {
		scope.__afterwordStatusSnapshotRefreshes = new Map<string, Promise<StatusFeedPage>>();
	}

	return scope;
}

function getBucket(context?: StatusSnapshotContext) {
	return context?.platform?.env?.R2_BUCKET ?? null;
}

function getBucketCacheKey(bucket: BoundR2Bucket) {
	const name =
		typeof bucket === 'object' && bucket && 'name' in bucket ? String(bucket.name || '') : '';

	return name || 'default';
}

async function readStatusSnapshotFromR2(bucket: BoundR2Bucket) {
	const object = await bucket.get(STATUS_SNAPSHOT_R2_KEY);

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
		const page = (await object.json()) as StatusFeedPage;

		if (!page || !Array.isArray(page.statuses)) {
			return null;
		}

		return { generatedAt, page };
	} catch {
		return null;
	}
}

async function writeStatusSnapshotToR2(bucket: BoundR2Bucket, page: StatusFeedPage) {
	await bucket.put(STATUS_SNAPSHOT_R2_KEY, JSON.stringify(page), {
		customMetadata: {
			generatedAt: new Date().toISOString()
		},
		httpMetadata: {
			contentType: 'application/json; charset=utf-8'
		}
	});
}

function writePageToMemoryCache(cacheKey: string, page: StatusFeedPage) {
	const scope = getStatusSnapshotScope();
	scope.__afterwordStatusSnapshotCache?.set(cacheKey, {
		expiresAt: Date.now() + STATUS_SNAPSHOT_TTL_MS,
		page
	});
}

async function rebuildStatusSnapshot(cacheKey: string, context?: StatusSnapshotContext) {
	const scope = getStatusSnapshotScope();
	const inflight = scope.__afterwordStatusSnapshotRefreshes?.get(cacheKey);

	if (inflight) {
		return inflight;
	}

	const refresh = (async () => {
		const page = await getStatusPage(undefined, {
			includeThreadContext: true,
			limit: STATUS_PAGE_SIZE,
			freshnessMs: 0
		});

		writePageToMemoryCache(cacheKey, page);

		const bucket = getBucket(context);
		if (bucket) {
			try {
				await writeStatusSnapshotToR2(bucket, page);
			} catch {
				// Ignore snapshot write failures and keep the memory cache.
			}
		}

		return page;
	})();

	scope.__afterwordStatusSnapshotRefreshes?.set(cacheKey, refresh);

	try {
		return await refresh;
	} finally {
		scope.__afterwordStatusSnapshotRefreshes?.delete(cacheKey);
	}
}

export async function getStatusSnapshotPage(context?: StatusSnapshotContext) {
	const scope = getStatusSnapshotScope();
	const bucket = getBucket(context);
	const cacheKey = bucket ? getBucketCacheKey(bucket) : 'default';
	const cached = scope.__afterwordStatusSnapshotCache?.get(cacheKey);

	if (cached?.expiresAt && cached.expiresAt > Date.now()) {
		return cached.page;
	}

	if (cached?.page) {
		context?.platform?.ctx?.waitUntil?.(rebuildStatusSnapshot(cacheKey, context).catch(() => {}));
		return cached.page;
	}

	if (bucket) {
		try {
			const snapshot = await readStatusSnapshotFromR2(bucket);
			const generatedAt = snapshot?.generatedAt ? Date.parse(snapshot.generatedAt) : NaN;

			if (snapshot) {
				writePageToMemoryCache(cacheKey, snapshot.page);

				if (
					!Number.isFinite(generatedAt) ||
					generatedAt + STATUS_SNAPSHOT_TTL_MS <= Date.now()
				) {
					context?.platform?.ctx?.waitUntil?.(
						rebuildStatusSnapshot(cacheKey, context).catch(() => {})
					);
				}

				return snapshot.page;
			}
		} catch {
			// Fall through to a live rebuild below.
		}
	}

	return rebuildStatusSnapshot(cacheKey, context);
}

export async function refreshStatusSnapshot(context?: StatusSnapshotContext) {
	const bucket = getBucket(context);
	const cacheKey = bucket ? getBucketCacheKey(bucket) : 'default';
	return rebuildStatusSnapshot(cacheKey, context);
}
