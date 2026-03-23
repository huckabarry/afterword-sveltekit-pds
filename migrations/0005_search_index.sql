CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5 (
	post_id UNINDEXED,
	slug UNINDEXED,
	path UNINDEXED,
	title,
	excerpt,
	body,
	tags,
	section,
	cover_image UNINDEXED,
	published_at UNINDEXED,
	tokenize = 'unicode61'
);
