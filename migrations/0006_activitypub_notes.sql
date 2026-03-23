CREATE TABLE IF NOT EXISTS ap_notes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	note_id TEXT NOT NULL UNIQUE,
	origin TEXT NOT NULL,
	activity_id TEXT UNIQUE,
	actor_id TEXT NOT NULL,
	actor_name TEXT,
	actor_handle TEXT,
	in_reply_to_object_id TEXT,
	thread_root_object_id TEXT,
	content_html TEXT NOT NULL,
	content_text TEXT NOT NULL,
	published_at TEXT NOT NULL,
	object_url TEXT,
	local_slug TEXT UNIQUE,
	delivery_status TEXT,
	raw_activity_json TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ap_notes_in_reply_to_idx ON ap_notes(in_reply_to_object_id);
CREATE INDEX IF NOT EXISTS ap_notes_thread_root_idx ON ap_notes(thread_root_object_id);
