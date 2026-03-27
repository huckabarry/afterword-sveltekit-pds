import type { RequestEvent } from '@sveltejs/kit';
import {
	ensureGalleryPhotoAsset,
	type GalleryPhotoItem
} from '$lib/server/gallery-assets';
import { getPhotoItems } from '$lib/server/ghost';

type GalleryDb = NonNullable<App.Platform['env']['D1_DATABASE']>;
type GalleryBucket = NonNullable<App.Platform['env']['R2_BUCKET']>;

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

export type GalleryManifestSummary = {
	configured: boolean;
	totalPhotos: number;
	syncedToR2: number;
	lastSyncedAt: string | null;
};

type SyncPhotoManifestBatchOptions = {
	offset?: number;
	limit?: number;
};

function getGalleryDb(event: Pick<RequestEvent, 'platform'>) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

function getGalleryBucket(event: Pick<RequestEvent, 'platform'>) {
	return event.platform?.env?.R2_BUCKET ?? null;
}

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

function toPositiveInteger(value: number | undefined, fallback: number) {
	const normalized = Number.isFinite(value) ? Number(value) : fallback;
	return normalized > 0 ? Math.floor(normalized) : fallback;
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
	const allPhotos = (await getPhotoItems()).sort((a, b) => {
		const dateDiff = a.postPublishedAt.getTime() - b.postPublishedAt.getTime();
		return dateDiff || a.index - b.index;
	});
	const batch = allPhotos.slice(offset, offset + limit);
	const synced: GalleryPhotoItem[] = [];
	const failures: Array<{ id: string; postTitle: string; error: string }> = [];

	for (const photo of batch) {
		try {
			const asset = await ensureGalleryPhotoAsset(photo, bucket as GalleryBucket);
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
		totalAvailable: allPhotos.length,
		offset,
		limit,
		processed: batch.length,
		syncedCount: synced.length,
		failures,
		nextOffset: offset + batch.length < allPhotos.length ? offset + batch.length : null
	};
}
