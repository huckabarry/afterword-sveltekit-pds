CREATE TABLE IF NOT EXISTS indieauth_codes (
	code TEXT PRIMARY KEY,
	client_id TEXT NOT NULL,
	redirect_uri TEXT NOT NULL,
	scope TEXT,
	code_challenge TEXT,
	code_challenge_method TEXT,
	expires_at TEXT NOT NULL,
	used_at TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS indieauth_tokens (
	access_token TEXT PRIMARY KEY,
	client_id TEXT NOT NULL,
	scope TEXT,
	me TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS indieauth_codes_expires_idx ON indieauth_codes(expires_at);

ALTER TABLE ap_notes ADD COLUMN title TEXT;
ALTER TABLE ap_notes ADD COLUMN category TEXT;
