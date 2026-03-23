CREATE TABLE IF NOT EXISTS site_profile (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	display_name TEXT NOT NULL DEFAULT 'Bryan Robb',
	avatar_url TEXT NOT NULL DEFAULT '/assets/images/status-avatar.jpg',
	header_image_url TEXT,
	bio TEXT NOT NULL DEFAULT 'Writer, photographer, and urban planner publishing from Afterword.',
	verification_links_json TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO site_profile (id, display_name, avatar_url, header_image_url, bio, verification_links_json)
VALUES (
	1,
	'Bryan Robb',
	'/assets/images/status-avatar.jpg',
	NULL,
	'Writer, photographer, and urban planner publishing from Afterword.',
	'[{"label":"Bluesky","url":"https://bsky.app/profile/afterword.blog"}]'
)
ON CONFLICT(id) DO NOTHING;
