CREATE TABLE IF NOT EXISTS mastodon_remote_statuses (
	object_id TEXT PRIMARY KEY,
	actor_id TEXT NOT NULL,
	actor_name TEXT,
	actor_handle TEXT,
	actor_summary TEXT,
	actor_url TEXT,
	actor_avatar_url TEXT,
	actor_header_url TEXT,
	content_html TEXT NOT NULL,
	content_text TEXT NOT NULL,
	published_at TEXT NOT NULL,
	object_url TEXT,
	in_reply_to_object_id TEXT,
	attachments_json TEXT NOT NULL DEFAULT '[]',
	mentions_json TEXT NOT NULL DEFAULT '[]',
	raw_object_json TEXT,
	fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mastodon_remote_statuses_actor_published
	ON mastodon_remote_statuses(actor_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_mastodon_remote_statuses_reply_target
	ON mastodon_remote_statuses(in_reply_to_object_id);
