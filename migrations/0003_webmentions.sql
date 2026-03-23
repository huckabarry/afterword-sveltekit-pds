CREATE TABLE IF NOT EXISTS webmentions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	source_url TEXT NOT NULL,
	target_url TEXT NOT NULL,
	source_domain TEXT,
	status TEXT NOT NULL DEFAULT 'pending',
	http_status INTEGER,
	source_title TEXT,
	error_message TEXT,
	verified_at TEXT,
	last_checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(source_url, target_url)
);

CREATE INDEX IF NOT EXISTS webmentions_target_idx ON webmentions(target_url);
CREATE INDEX IF NOT EXISTS webmentions_status_idx ON webmentions(status);
