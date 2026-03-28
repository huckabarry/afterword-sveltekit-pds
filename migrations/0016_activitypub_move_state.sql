CREATE TABLE IF NOT EXISTS activitypub_move_state (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	target_handle TEXT,
	target_actor_url TEXT,
	move_started_at TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO activitypub_move_state (id, target_handle, target_actor_url, move_started_at)
SELECT
	1,
	move_target_handle,
	move_target_actor_url,
	move_started_at
FROM site_profile
WHERE id = 1
ON CONFLICT(id) DO NOTHING;
