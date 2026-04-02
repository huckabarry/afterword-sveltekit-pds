import type { RequestEvent } from '@sveltejs/kit';
import {
	ensureGalleryPhotoAsset,
	ensureGalleryPhotoVariants,
	type GalleryPhotoItem
} from '$lib/server/gallery-assets';
import {
	getBlogPostBySlug,
	getPhotoItems,
	getPostImages,
	type PhotoItem
} from '$lib/server/ghost';
import { refreshGallerySnapshot } from '$lib/server/gallery-snapshot';

type GalleryDb = NonNullable<App.Platform['env']['D1_DATABASE']>;
type GalleryBucket = NonNullable<App.Platform['env']['R2_BUCKET']>;
type GalleryImages = NonNullable<App.Platform['env']['IMAGES']>;

type GalleryPhotoManifestRow = {
	id: string;
	post_id: string;
	post_title: string;
	post_path: string;
	post_source_url: string;
	post_published_at: string;
	image_url: string;
	alt: string;
	sort_index: number;
	asset_key: string;
	is_synced_to_r2: number;
	original_url: string;
	display_url: string;
	lightbox_url: string;
	width: number | null;
	height: number | null;
	synced_at: string;
	updated_at: string;
};

type GalleryManifestSummaryRow = {
	total_photos: number | null;
	synced_to_r2: number | null;
	last_synced_at: string | null;
};

type PhotoSyncStateRow = {
	sync_key: string;
	next_offset: number | null;
	last_run_at: string | null;
	last_cycle_completed_at: string | null;
	last_error: string | null;
	total_available: number | null;
	updated_at: string | null;
};

export type GalleryManifestSummary = {
	configured: boolean;
	totalPhotos: number;
	syncedToR2: number;
	lastSyncedAt: string | null;
};

export type PhotoSyncState = {
	syncKey: string;
	nextOffset: number;
	lastRunAt: string | null;
	lastCycleCompletedAt: string | null;
	lastError: string | null;
	totalAvailable: number;
	updatedAt: string | null;
};

type SyncPhotoManifestBatchOptions = {
	offset?: number;
	limit?: number;
};

type SyncManifestPhotosResult = {
	processed: number;
	syncedCount: number;
	failures: Array<{ id: string; postTitle: string; error: string }>;
	synced: GalleryPhotoItem[];
};

function getGalleryDb(event: Pick<RequestEvent, 'platform'>) {
	try {
		return (
			event.platform?.env?.D1_DATABASE ??
			event.platform?.env?.D1_DATABASE_BINDING ??
			event.platform?.env?.AP_DB ??
			null
		);
	} catch {
		return null;
	}
}

function getGalleryBucket(event: Pick<RequestEvent, 'platform'>) {
	try {
		return event.platform?.env?.R2_BUCKET ?? null;
	} catch {
		return null;
	}
}

function getGalleryImages(event: Pick<RequestEvent, 'platform'>) {
	try {
		return event.platform?.env?.IMAGES ?? null;
	} catch {
		return null;
	}
}

const PHOTO_SYNC_KEY = 'ghost_gallery_manifest';

async function ensureGalleryPhotoManifestSchema(db: GalleryDb) {
	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS gallery_photo_manifest (
				id TEXT PRIMARY KEY,
				post_id TEXT NOT NULL,
				post_title TEXT NOT NULL,
				post_path TEXT NOT NULL,
				post_source_url TEXT NOT NULL,
				post_published_at TEXT NOT NULL,
				image_url TEXT NOT NULL,
				alt TEXT NOT NULL DEFAULT '',
				sort_index INTEGER NOT NULL,
				asset_key TEXT NOT NULL,
				is_synced_to_r2 INTEGER NOT NULL DEFAULT 0,
				original_url TEXT NOT NULL,
				display_url TEXT NOT NULL,
				lightbox_url TEXT NOT NULL,
				width INTEGER,
				height INTEGER,
				synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`
		)
		.run();
	await db
		.prepare(
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_photo_manifest_asset_key
				ON gallery_photo_manifest(asset_key)`
		)
		.run();
	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_gallery_photo_manifest_published
				ON gallery_photo_manifest(post_published_at DESC, sort_index ASC)`
		)
		.run();
}

async function ensurePhotoSyncStateSchema(db: GalleryDb) {
	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS photo_sync_state (
				sync_key TEXT PRIMARY KEY,
				next_offset INTEGER NOT NULL DEFAULT 0,
				last_run_at TEXT,
				last_cycle_completed_at TEXT,
				last_error TEXT,
				total_available INTEGER NOT NULL DEFAULT 0,
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`
		)
		.run();
}

function toPositiveInteger(value: number | undefined, fallback: number) {
	const normalized = Number.isFinite(value) ? Number(value) : fallback;
	return normalized > 0 ? Math.floor(normalized) : fallback;
}

function normalizePhotoSyncState(row: PhotoSyncStateRow | null | undefined): PhotoSyncState {
	return {
		syncKey: row?.sync_key || PHOTO_SYNC_KEY,
		nextOffset: Math.max(0, Number(row?.next_offset || 0)),
		lastRunAt: row?.last_run_at || null,
		lastCycleCompletedAt: row?.last_cycle_completed_at || null,
		lastError: row?.last_error || null,
		totalAvailable: Math.max(0, Number(row?.total_available || 0)),
		updatedAt: row?.updated_at || null
	};
}

async function getSortedGhostPhotoItems() {
	return (await getPhotoItems()).sort((a, b) => {
		const dateDiff = a.postPublishedAt.getTime() - b.postPublishedAt.getTime();
		return dateDiff || a.index - b.index;
	});
}

async function getRecentGhostPhotoItems(limit: number) {
	const normalizedLimit = Math.min(Math.max(Math.floor(limit), 1), 60);

	return (await getPhotoItems())
		.sort((a, b) => {
			const dateDiff = b.postPublishedAt.getTime() - a.postPublishedAt.getTime();
			return dateDiff || a.index - b.index;
		})
		.slice(0, normalizedLimit);
}

function toGalleryPhotoItem(row: GalleryPhotoManifestRow): GalleryPhotoItem {
	return {
		id: row.id,
		postId: row.post_id,
		postTitle: row.post_title,
		postPath: row.post_path,
		postSourceUrl: row.post_source_url,
		postPublishedAt: new Date(row.post_published_at),
		imageUrl: row.image_url,
		alt: row.alt || row.post_title,
		index: row.sort_index,
		assetKey: row.asset_key,
		isSyncedToR2: Boolean(row.is_synced_to_r2),
		originalUrl: row.original_url,
		displayUrl: row.display_url,
		lightboxUrl: row.lightbox_url,
		width: row.width,
		height: row.height
	};
}

async function upsertGalleryPhotoManifestRow(
	db: GalleryDb,
	photo: GalleryPhotoItem
) {
	await db
		.prepare(
			`INSERT INTO gallery_photo_manifest (
				id,
				post_id,
				post_title,
				post_path,
				post_source_url,
				post_published_at,
				image_url,
				alt,
				sort_index,
				asset_key,
				is_synced_to_r2,
				original_url,
				display_url,
				lightbox_url,
				width,
				height,
				synced_at,
				updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			ON CONFLICT(id) DO UPDATE SET
				post_id = excluded.post_id,
				post_title = excluded.post_title,
				post_path = excluded.post_path,
				post_source_url = excluded.post_source_url,
				post_published_at = excluded.post_published_at,
				image_url = excluded.image_url,
				alt = excluded.alt,
				sort_index = excluded.sort_index,
				asset_key = excluded.asset_key,
				is_synced_to_r2 = excluded.is_synced_to_r2,
				original_url = excluded.original_url,
				display_url = excluded.display_url,
				lightbox_url = excluded.lightbox_url,
				width = excluded.width,
				height = excluded.height,
				synced_at = CURRENT_TIMESTAMP,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			photo.id,
			photo.postId,
			photo.postTitle,
			photo.postPath,
			photo.postSourceUrl,
			photo.postPublishedAt.toISOString(),
			photo.imageUrl,
			photo.alt || photo.postTitle,
			photo.index,
			photo.assetKey,
			photo.isSyncedToR2 ? 1 : 0,
			photo.originalUrl,
			photo.displayUrl,
			photo.lightboxUrl,
			photo.width,
			photo.height
		)
		.run();
}

async function syncManifestPhotos(
	db: GalleryDb,
	bucket: GalleryBucket,
	images: GalleryImages | null,
	photos: PhotoItem[]
): Promise<SyncManifestPhotosResult> {
	const synced: GalleryPhotoItem[] = [];
	const failures: Array<{ id: string; postTitle: string; error: string }> = [];

	for (const photo of photos) {
		try {
			const asset = await ensureGalleryPhotoAsset(photo, bucket);
			if (images) {
				await ensureGalleryPhotoVariants(bucket, images, asset.assetKey);
			}
			const manifestItem: GalleryPhotoItem = {
				...photo,
				...asset
			};
			await upsertGalleryPhotoManifestRow(db, manifestItem);
			synced.push(manifestItem);
		} catch (error) {
			failures.push({
				id: photo.id,
				postTitle: photo.postTitle,
				error: error instanceof Error ? error.message : 'Unexpected sync error.'
			});
		}
	}

	return {
		processed: photos.length,
		syncedCount: synced.length,
		failures,
		synced
	};
}

export async function getGalleryManifestSummary(
	event: Pick<RequestEvent, 'platform'>
): Promise<GalleryManifestSummary> {
	const db = getGalleryDb(event);

	if (!db) {
		return {
			configured: false,
			totalPhotos: 0,
			syncedToR2: 0,
			lastSyncedAt: null
		};
	}

	await ensureGalleryPhotoManifestSchema(db);
	const summary =
		(await db
			.prepare(
				`SELECT
					COUNT(*) AS total_photos,
					COALESCE(SUM(is_synced_to_r2), 0) AS synced_to_r2,
					MAX(synced_at) AS last_synced_at
				FROM gallery_photo_manifest`
			)
			.first()) as GalleryManifestSummaryRow | null;

	return {
		configured: true,
		totalPhotos: Number(summary?.total_photos || 0),
		syncedToR2: Number(summary?.synced_to_r2 || 0),
		lastSyncedAt: summary?.last_synced_at || null
	};
}

export async function getPhotoSyncState(
	event: Pick<RequestEvent, 'platform'>
): Promise<PhotoSyncState> {
	const db = getGalleryDb(event);
	if (!db) {
		return normalizePhotoSyncState(null);
	}

	await ensurePhotoSyncStateSchema(db);
	const row = await db
		.prepare(
			`SELECT
				sync_key,
				next_offset,
				last_run_at,
				last_cycle_completed_at,
				last_error,
				total_available,
				updated_at
			FROM photo_sync_state
			WHERE sync_key = ?
			LIMIT 1`
		)
		.bind(PHOTO_SYNC_KEY)
		.first<PhotoSyncStateRow>();

	return normalizePhotoSyncState(row);
}

export async function getManifestGalleryPhotos(event: Pick<RequestEvent, 'platform'>) {
	const db = getGalleryDb(event);
	if (!db) return [] satisfies GalleryPhotoItem[];

	await ensureGalleryPhotoManifestSchema(db);
	const result = await db
		.prepare(
			`SELECT
				id,
				post_id,
				post_title,
				post_path,
				post_source_url,
				post_published_at,
				image_url,
				alt,
				sort_index,
				asset_key,
				is_synced_to_r2,
				original_url,
				display_url,
				lightbox_url,
				width,
				height,
				synced_at,
				updated_at
			FROM gallery_photo_manifest
			ORDER BY post_published_at DESC, sort_index ASC`
		)
		.all<GalleryPhotoManifestRow>();

	return (result.results || []).map(toGalleryPhotoItem);
}

export async function getRecentManifestGalleryPhotos(
	event: Pick<RequestEvent, 'platform'>,
	limit = 18
) {
	const db = getGalleryDb(event);
	if (!db) return [] satisfies GalleryPhotoItem[];

	await ensureGalleryPhotoManifestSchema(db);
	const normalizedLimit = Math.min(Math.max(Math.floor(limit), 1), 60);
	const result = await db
		.prepare(
			`SELECT
				id,
				post_id,
				post_title,
				post_path,
				post_source_url,
				post_published_at,
				image_url,
				alt,
				sort_index,
				asset_key,
				is_synced_to_r2,
				original_url,
				display_url,
				lightbox_url,
				width,
				height,
				synced_at,
				updated_at
			FROM gallery_photo_manifest
			ORDER BY post_published_at DESC, sort_index ASC
			LIMIT ?`
		)
		.bind(normalizedLimit)
		.all<GalleryPhotoManifestRow>();

	return (result.results || []).map(toGalleryPhotoItem);
}

export async function getPagedManifestGalleryPhotos(
	event: Pick<RequestEvent, 'platform'>,
	options: {
		page?: number;
		limit?: number;
	} = {}
) {
	const db = getGalleryDb(event);
	if (!db) {
		return {
			photos: [] satisfies GalleryPhotoItem[],
			page: 1,
			limit: 48,
			total: 0,
			totalPages: 1
		};
	}

	await ensureGalleryPhotoManifestSchema(db);
	const page = Math.max(1, Math.floor(options.page || 1));
	const limit = Math.min(Math.max(Math.floor(options.limit || 48), 1), 96);
	const offset = (page - 1) * limit;
	const totalRow = await db
		.prepare(`SELECT COUNT(*) AS total_count FROM gallery_photo_manifest`)
		.first<{ total_count?: number | null }>();
	const total = Number(totalRow?.total_count || 0);
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const normalizedPage = Math.min(page, totalPages);
	const normalizedOffset = (normalizedPage - 1) * limit;
	const result = await db
		.prepare(
			`SELECT
				id,
				post_id,
				post_title,
				post_path,
				post_source_url,
				post_published_at,
				image_url,
				alt,
				sort_index,
				asset_key,
				is_synced_to_r2,
				original_url,
				display_url,
				lightbox_url,
				width,
				height,
				synced_at,
				updated_at
			FROM gallery_photo_manifest
			ORDER BY post_published_at DESC, sort_index ASC
			LIMIT ? OFFSET ?`
		)
		.bind(limit, normalizedOffset)
		.all<GalleryPhotoManifestRow>();

	return {
		photos: (result.results || []).map(toGalleryPhotoItem),
		page: normalizedPage,
		limit,
		total,
		totalPages
	};
}

export async function syncPhotoManifestBatch(
	event: Pick<RequestEvent, 'platform'>,
	options: SyncPhotoManifestBatchOptions = {}
) {
	const db = getGalleryDb(event);
	const bucket = getGalleryBucket(event);

	if (!db) {
		throw new Error('D1 database is not configured');
	}

	if (!bucket) {
		throw new Error('R2_BUCKET is not configured');
	}

	await ensureGalleryPhotoManifestSchema(db);

	const offset = toPositiveInteger(options.offset, 0);
	const limit = Math.min(toPositiveInteger(options.limit, 20), 50);
	const allPhotos = await getSortedGhostPhotoItems();
	const batch = allPhotos.slice(offset, offset + limit);
	const result = await syncManifestPhotos(
		db,
		bucket as GalleryBucket,
		getGalleryImages(event),
		batch
	);

	return {
		totalAvailable: allPhotos.length,
		offset,
		limit,
		processed: result.processed,
		syncedCount: result.syncedCount,
		failures: result.failures,
		nextOffset: offset + batch.length < allPhotos.length ? offset + batch.length : null
	};
}

export async function runScheduledPhotoSyncBatch(
	event: Pick<RequestEvent, 'platform'>,
	options: {
		limit?: number;
	} = {}
) {
	const db = getGalleryDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	await ensurePhotoSyncStateSchema(db);
	const state = await getPhotoSyncState(event);
	const limit = Math.min(toPositiveInteger(options.limit, 12), 25);
	const result = await syncPhotoManifestBatch(event, {
		offset: state.nextOffset,
		limit
	});
	const lastRunAt = new Date().toISOString();
	const cycleCompleted = result.nextOffset === null;
	const nextOffset = cycleCompleted ? 0 : result.nextOffset ?? 0;
	const lastError = result.failures.length
		? result.failures
				.slice(0, 3)
				.map((failure) => `${failure.postTitle}: ${failure.error}`)
				.join(' | ')
		: null;

	await db
		.prepare(
			`INSERT INTO photo_sync_state (
				sync_key,
				next_offset,
				last_run_at,
				last_cycle_completed_at,
				last_error,
				total_available,
				updated_at
			) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(sync_key) DO UPDATE SET
				next_offset = excluded.next_offset,
				last_run_at = excluded.last_run_at,
				last_cycle_completed_at = COALESCE(excluded.last_cycle_completed_at, photo_sync_state.last_cycle_completed_at),
				last_error = excluded.last_error,
				total_available = excluded.total_available,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			PHOTO_SYNC_KEY,
			nextOffset,
			lastRunAt,
			cycleCompleted ? lastRunAt : null,
			lastError,
			result.totalAvailable
		)
		.run();

	return {
		...result,
		limit,
		state: await getPhotoSyncState(event),
		cycleCompleted
	};
}

export async function syncRecentPhotoManifestBatch(
	event: Pick<RequestEvent, 'platform'>,
	options: {
		limit?: number;
	} = {}
) {
	const db = getGalleryDb(event);
	const bucket = getGalleryBucket(event);

	if (!db) {
		throw new Error('D1 database is not configured');
	}

	if (!bucket) {
		throw new Error('R2_BUCKET is not configured');
	}

	await ensureGalleryPhotoManifestSchema(db);

	const limit = Math.min(toPositiveInteger(options.limit, 18), 60);
	const photos = await getRecentGhostPhotoItems(limit);
	const result = await syncManifestPhotos(
		db,
		bucket as GalleryBucket,
		getGalleryImages(event),
		photos
	);

	await refreshGallerySnapshot(event).catch(() => {});

	return {
		limit,
		processed: result.processed,
		syncedCount: result.syncedCount,
		failures: result.failures
	};
}

export async function syncGhostPostPhotoManifestBySlug(
	event: Pick<RequestEvent, 'platform'>,
	slug: string
) {
	const db = getGalleryDb(event);
	const bucket = getGalleryBucket(event);

	if (!db) {
		throw new Error('D1 database is not configured');
	}

	if (!bucket) {
		throw new Error('R2_BUCKET is not configured');
	}

	const normalizedSlug = String(slug || '').trim();

	if (!normalizedSlug) {
		throw new Error('A Ghost post slug is required');
	}

	await ensureGalleryPhotoManifestSchema(db);

	const post = await getBlogPostBySlug(normalizedSlug);

	if (!post) {
		throw new Error(`Ghost post not found for slug "${normalizedSlug}"`);
	}

	const photos = getPostImages(post);
	const result = await syncManifestPhotos(
		db,
		bucket as GalleryBucket,
		getGalleryImages(event),
		photos
	);

	await refreshGallerySnapshot(event).catch(() => {});

	return {
		slug: normalizedSlug,
		processed: result.processed,
		syncedCount: result.syncedCount,
		failures: result.failures
	};
}

export async function syncGalleryPhotoManifestForItems(
	event: Pick<RequestEvent, 'platform'>,
	photos: PhotoItem[]
) {
	const db = getGalleryDb(event);
	const bucket = getGalleryBucket(event);

	if (!db || !bucket) {
		return {
			processed: 0,
			syncedCount: 0,
			failures: [] satisfies Array<{ id: string; postTitle: string; error: string }>
		};
	}

	await ensureGalleryPhotoManifestSchema(db);

	const uniquePhotos = Array.from(
		new Map((photos || []).map((photo) => [photo.id, photo] as const)).values()
	);
	const result = await syncManifestPhotos(
		db,
		bucket as GalleryBucket,
		getGalleryImages(event),
		uniquePhotos
	);

	await refreshGallerySnapshot(event).catch(() => {});

	return {
		processed: result.processed,
		syncedCount: result.syncedCount,
		failures: result.failures
	};
}
