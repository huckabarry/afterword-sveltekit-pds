import type { RequestEvent } from '@sveltejs/kit';
import { searchEarlierWebPosts } from '$lib/server/earlier-web';
import { getBlogPosts, type BlogPost } from '$lib/server/ghost';
import { getAlbums, getTracks } from '$lib/server/music';

type SearchDb = NonNullable<App.Platform['env']['D1_DATABASE']>;

export type SearchResult = {
	id: string;
	slug: string;
	path: string;
	title: string;
	excerpt: string;
	section: string;
	coverImage: string | null;
	publishedAt: string;
	hideTitle?: boolean;
};

type RankedSearchResult = SearchResult & {
	score: number;
};

function getSearchDb(event: RequestEvent): SearchDb | null {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

function stripHtml(value: string) {
	return String(value || '')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, ' ')
		.replace(/<img\b[^>]*>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

function classifySection(post: BlogPost) {
	const tags = new Set(post.publicTags.map((tag) => tag.slug));

	if (
		tags.has('urbanism') ||
		tags.has('housing') ||
		tags.has('transportation') ||
		tags.has('public-finance')
	) {
		return 'Planning & Urbanism';
	}

	if (tags.has('field-notes') || tags.has('gallery') || tags.has('photography')) {
		return 'Field Notes';
	}

	if (tags.has('book-reviews')) {
		return 'Books';
	}

	return 'Writing';
}

function toSearchDocument(post: BlogPost) {
	return {
		postId: post.id,
		slug: post.slug,
		path: post.path,
		title: post.title,
		excerpt: post.excerpt,
		body: stripHtml(post.html),
		tags: post.publicTags.map((tag) => tag.label).join(' '),
		section: classifySection(post),
		coverImage: post.coverImage,
		publishedAt: post.publishedAt.toISOString()
	};
}

function quoteFtsTerm(term: string) {
	return `"${term.replace(/"/g, '""')}"*`;
}

function buildFtsQuery(query: string) {
	const terms = String(query || '')
		.toLowerCase()
		.trim()
		.split(/\s+/)
		.map((term) => term.replace(/[^a-z0-9-]+/gi, ''))
		.filter(Boolean)
		.slice(0, 8);

	if (!terms.length) {
		return null;
	}

	return terms.map(quoteFtsTerm).join(' AND ');
}

function scorePost(post: BlogPost, query: string) {
	const haystack = [post.title, post.excerpt, stripHtml(post.html), post.publicTags.map((tag) => tag.label).join(' ')]
		.join(' ')
		.toLowerCase();
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.map((term) => term.trim())
		.filter(Boolean);

	let score = 0;

	for (const term of terms) {
		if (post.title.toLowerCase().includes(term)) score += 10;
		if (post.excerpt.toLowerCase().includes(term)) score += 5;
		if (haystack.includes(term)) score += 1;
	}

	return score;
}

function scoreText(haystackParts: Array<string | null | undefined>, query: string) {
	const haystack = haystackParts
		.map((part) => String(part || '').trim().toLowerCase())
		.filter(Boolean)
		.join(' ');
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.map((term) => term.trim())
		.filter(Boolean);

	let score = 0;

	for (const term of terms) {
		if (!term) continue;
		if (haystack.includes(term)) score += 1;
	}

	return score;
}

function postToResult(post: BlogPost): SearchResult {
	return {
		id: post.id,
		slug: post.slug,
		path: post.path,
		title: post.title,
		excerpt: post.excerpt,
		section: classifySection(post),
		coverImage: post.coverImage,
		publishedAt: post.publishedAt.toISOString()
	};
}

function rankSearchResult(result: SearchResult, query: string) {
	return {
		...result,
		score:
			scoreText([result.title, result.excerpt, result.section], query) +
			(result.title.toLowerCase().includes(query.toLowerCase()) ? 10 : 0)
	} satisfies RankedSearchResult;
}

export async function syncSearchIndex(event: RequestEvent) {
	const db = getSearchDb(event);

	if (!db) {
		throw new Error('D1 search database is not configured');
	}

	const posts = await getBlogPosts();
	const docs = posts.map(toSearchDocument);
	const statements = [db.prepare('DELETE FROM search_index')];

	for (const doc of docs) {
		statements.push(
			db
				.prepare(
					`INSERT INTO search_index (
						post_id,
						slug,
						path,
						title,
						excerpt,
						body,
						tags,
						section,
						cover_image,
						published_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					doc.postId,
					doc.slug,
					doc.path,
					doc.title,
					doc.excerpt,
					doc.body,
					doc.tags,
					doc.section,
					doc.coverImage,
					doc.publishedAt
				)
		);
	}

	await db.batch(statements);

	return {
		indexed: docs.length
	};
}

async function fallbackSearch(query: string, limit: number): Promise<RankedSearchResult[]> {
	const posts = await getBlogPosts();

	return posts
		.map((post) => ({ post, score: scorePost(post, query) }))
		.filter((entry) => entry.score > 0)
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return b.post.publishedAt.getTime() - a.post.publishedAt.getTime();
		})
		.slice(0, limit)
		.map((entry) => ({
			...postToResult(entry.post),
			score: entry.score
		}));
}

async function searchMusic(event: RequestEvent, query: string, limit: number): Promise<RankedSearchResult[]> {
	const [albums, tracks] = await Promise.all([getAlbums(event), getTracks(event)]);
	const rankedAlbums = albums
		.map((album) => ({
			id: `album:${album.id}`,
			slug: album.slug,
			path: album.localPath,
			title: album.albumTitle,
			excerpt: album.excerpt,
			section: 'Music',
			coverImage: album.coverImage,
			publishedAt: album.publishedAt.toISOString(),
			score:
				scoreText([album.albumTitle, album.artist, album.note, album.excerpt], query) +
				(album.albumTitle.toLowerCase().includes(query.toLowerCase()) ? 10 : 0) +
				(album.artist.toLowerCase().includes(query.toLowerCase()) ? 8 : 0)
		}))
		.filter((entry) => entry.score > 0);
	const rankedTracks = tracks
		.map((track) => ({
			id: `track:${track.id}`,
			slug: track.slug,
			path: track.localPath,
			title: track.trackTitle,
			excerpt: track.excerpt,
			section: 'Listening',
			coverImage: track.artworkUrl,
			publishedAt: track.publishedAt.toISOString(),
			score:
				scoreText([track.trackTitle, track.artist, track.note, track.excerpt], query) +
				(track.trackTitle.toLowerCase().includes(query.toLowerCase()) ? 10 : 0) +
				(track.artist.toLowerCase().includes(query.toLowerCase()) ? 8 : 0)
		}))
		.filter((entry) => entry.score > 0);

	return [...rankedAlbums, ...rankedTracks]
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
		})
		.slice(0, limit);
}

function mergeSearchResults(results: RankedSearchResult[], limit: number): SearchResult[] {
	const merged = new Map<string, RankedSearchResult>();

	for (const result of results) {
		const existing = merged.get(result.path);

		if (
			!existing ||
			result.score > existing.score ||
			(result.score === existing.score && Date.parse(result.publishedAt) > Date.parse(existing.publishedAt))
		) {
			merged.set(result.path, result);
		}
	}

	return [...merged.values()]
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
		})
		.slice(0, limit)
		.map((result) => ({
			id: result.id,
			slug: result.slug,
			path: result.path,
			title: result.title,
			excerpt: result.excerpt,
			section: result.section,
			coverImage: result.coverImage,
			publishedAt: result.publishedAt
		}));
}

export async function searchPosts(event: RequestEvent, query: string, limit = 8): Promise<SearchResult[]> {
	const trimmed = String(query || '').trim();

	if (trimmed.length < 2) {
		return [];
	}

	const db = getSearchDb(event);
	const ftsQuery = buildFtsQuery(trimmed);
	const musicResults = await searchMusic(event, trimmed, limit);
	const earlierWebResults = (await searchEarlierWebPosts(event, trimmed, limit)).map((result) =>
		rankSearchResult(result, trimmed)
	);

	if (db && ftsQuery) {
		try {
			const result = await db
				.prepare(
					`SELECT
						post_id as id,
						slug,
						path,
						title,
						excerpt,
						section,
						cover_image as coverImage,
						published_at as publishedAt,
						bm25(search_index, 10.0, 4.0, 1.5, 0.8, 0.5) as rank
					FROM search_index
					WHERE search_index MATCH ?
					ORDER BY rank
					LIMIT ?`
				)
				.bind(ftsQuery, Math.max(1, Math.min(limit, 20)))
				.all<SearchResult & { rank: number }>();

			const rows: Array<SearchResult & { rank: number }> = Array.isArray(result.results)
				? (result.results as Array<SearchResult & { rank: number }>)
				: [];

			if (rows.length) {
				const dbResults = rows.map((row: SearchResult & { rank: number }) =>
					rankSearchResult(
						{
							id: row.id,
							slug: row.slug,
							path: row.path,
							title: row.title,
							excerpt: row.excerpt,
							section: row.section,
							coverImage: row.coverImage,
							publishedAt: row.publishedAt
						},
						trimmed
					)
				);

				return mergeSearchResults([...dbResults, ...musicResults, ...earlierWebResults], limit);
			}
		} catch {
			// Fall back to live search if D1 is unavailable, uninitialized, or the FTS query errors.
		}
	}

	return mergeSearchResults(
		[...(await fallbackSearch(trimmed, limit)), ...musicResults, ...earlierWebResults],
		limit
	);
}
