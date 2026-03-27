CREATE TABLE IF NOT EXISTS photo_sync_state (
	sync_key TEXT PRIMARY KEY,
	next_offset INTEGER NOT NULL DEFAULT 0,
	last_run_at TEXT,
	last_cycle_completed_at TEXT,
	last_error TEXT,
	total_available INTEGER NOT NULL DEFAULT 0,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
