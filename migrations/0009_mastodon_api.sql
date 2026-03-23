CREATE TABLE IF NOT EXISTS mastodon_apps (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	client_name TEXT NOT NULL,
	redirect_uris TEXT NOT NULL,
	scopes TEXT NOT NULL,
	website TEXT,
	client_id TEXT NOT NULL UNIQUE,
	client_secret TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS mastodon_apps_client_id_idx
	ON mastodon_apps(client_id);

CREATE TABLE IF NOT EXISTS mastodon_auth_codes (
	code TEXT PRIMARY KEY,
	app_id INTEGER NOT NULL,
	redirect_uri TEXT NOT NULL,
	scopes TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	used_at TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS mastodon_auth_codes_app_idx
	ON mastodon_auth_codes(app_id);

CREATE TABLE IF NOT EXISTS mastodon_access_tokens (
	token TEXT PRIMARY KEY,
	app_id INTEGER NOT NULL,
	scopes TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS mastodon_tokens_app_idx
	ON mastodon_access_tokens(app_id);
