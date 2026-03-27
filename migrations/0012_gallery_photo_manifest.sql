CREATE TABLE IF NOT EXISTS gallery_photo_manifest (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_photo_manifest_asset_key
	ON gallery_photo_manifest(asset_key);

CREATE INDEX IF NOT EXISTS idx_gallery_photo_manifest_published
	ON gallery_photo_manifest(post_published_at DESC, sort_index ASC);
