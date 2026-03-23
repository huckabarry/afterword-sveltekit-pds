CREATE TABLE IF NOT EXISTS ap_followers (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	actor_id TEXT NOT NULL UNIQUE,
	inbox_url TEXT,
	shared_inbox_url TEXT,
	display_name TEXT,
	handle TEXT,
	follow_activity_id TEXT NOT NULL UNIQUE,
	accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_delivery_at TEXT,
	last_delivery_status TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ap_followers_actor_id_idx ON ap_followers(actor_id);
CREATE INDEX IF NOT EXISTS ap_followers_handle_idx ON ap_followers(handle);

