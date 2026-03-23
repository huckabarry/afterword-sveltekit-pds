CREATE TABLE IF NOT EXISTS mastodon_favourites (
	object_id TEXT PRIMARY KEY,
	activity_id TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ap_following (
	actor_id TEXT PRIMARY KEY,
	inbox_url TEXT,
	shared_inbox_url TEXT,
	display_name TEXT,
	handle TEXT,
	profile_url TEXT,
	follow_activity_id TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
