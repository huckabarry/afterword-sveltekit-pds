CREATE TABLE IF NOT EXISTS mastodon_apps (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	website TEXT,
	redirect_uris TEXT NOT NULL,
	scopes TEXT NOT NULL DEFAULT 'read write',
	client_id TEXT NOT NULL UNIQUE,
	client_secret TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mastodon_oauth_codes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	code TEXT NOT NULL UNIQUE,
	client_id TEXT NOT NULL,
	redirect_uri TEXT NOT NULL,
	scope TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	used_at TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mastodon_oauth_codes_client
	ON mastodon_oauth_codes (client_id);

CREATE TABLE IF NOT EXISTS mastodon_access_tokens (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	token TEXT NOT NULL UNIQUE,
	client_id TEXT NOT NULL,
	scope TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_mastodon_access_tokens_client
	ON mastodon_access_tokens (client_id);
