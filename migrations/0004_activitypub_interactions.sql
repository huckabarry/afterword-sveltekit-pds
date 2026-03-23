CREATE TABLE IF NOT EXISTS ap_interactions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	activity_id TEXT NOT NULL UNIQUE,
	activity_type TEXT NOT NULL,
	actor_id TEXT NOT NULL,
	object_id TEXT NOT NULL,
	object_url TEXT,
	raw_activity_json TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ap_interactions_object_idx ON ap_interactions(object_id);
CREATE INDEX IF NOT EXISTS ap_interactions_actor_idx ON ap_interactions(actor_id);
CREATE INDEX IF NOT EXISTS ap_interactions_type_idx ON ap_interactions(activity_type);
