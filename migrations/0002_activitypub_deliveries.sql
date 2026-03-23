CREATE TABLE IF NOT EXISTS ap_deliveries (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	object_id TEXT NOT NULL,
	object_url TEXT NOT NULL,
	follower_actor_id TEXT NOT NULL,
	inbox_url TEXT NOT NULL,
	activity_id TEXT NOT NULL,
	status TEXT NOT NULL,
	response_status INTEGER,
	error_message TEXT,
	last_attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	delivered_at TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(object_id, follower_actor_id)
);

CREATE INDEX IF NOT EXISTS ap_deliveries_object_idx ON ap_deliveries(object_id);
CREATE INDEX IF NOT EXISTS ap_deliveries_follower_idx ON ap_deliveries(follower_actor_id);
