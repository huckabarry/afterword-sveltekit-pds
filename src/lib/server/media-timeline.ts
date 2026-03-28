import { getRecentTaggedPosts, type BlogPost } from '$lib/server/ghost';
import { getAlbums, getTracks } from '$lib/server/music';
import { getPopfeedItems } from '$lib/server/popfeed';
import type {
	AlbumTimelineItem,
	MediaTimelineItem,
	MediaTimelinePage,
	PopfeedTimelineItem,
	PostTimelineItem,
	TimelineLink,
	TrackTimelineItem
} from '$lib/types/media-timeline';

const BOOK_TAGS = ['books', 'book-reviews'];
const SCREEN_TAGS = ['movie', 'movies', 'film', 'films', 'show', 'shows', 'tv', 'watching'];
const CLASSIFICATION_TAGS = new Set([
	'books',
	'book-reviews',
	'movie',
	'movies',
	'film',
	'films',
	'show',
	'shows',
	'tv',
	'watching'
]);
const MEDIA_TIMELINE_CACHE_TTL_MS = 1000 * 60 * 5;
export const MEDIA_TIMELINE_PAGE_SIZE = 20;

type MediaTimelineCacheEntry = {
	expiresAt: number;
	items: MediaTimelineItem[];
};

function getTimelineCache() {
	const scope = globalThis as typeof globalThis & {
		__afterwordMediaTimelineCache?: MediaTimelineCacheEntry | null;
	};

	if (!scope.__afterwordMediaTimelineCache) {
		scope.__afterwordMediaTimelineCache = null;
	}

	return scope;
}

function dedupePosts(posts: BlogPost[]) {
	return [...new Map(posts.map((post) => [post.id, post])).values()].sort(
		(a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
	);
}

function stripHtml(value: string) {
	return String(value || '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function summarize(value: string, maxLength = 220) {
	const text = stripHtml(value);

	if (!text || text.length <= maxLength) {
		return text;
	}

	const clipped = text.slice(0, maxLength).replace(/\s+\S*$/, '');
	return `${clipped}…`;
}

function formatTimelineDate(value: Date) {
	const date = value instanceof Date ? value : new Date(value);
	const currentYear = new Date().getFullYear();

	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		...(date.getFullYear() !== currentYear ? { year: 'numeric' as const } : {})
	}).format(date);
}

function getPostTags(post: BlogPost) {
	return (post.publicTags || [])
		.filter((tag) => !CLASSIFICATION_TAGS.has(tag.slug))
		.map((tag) => tag.label)
		.slice(0, 4);
}

function getPostLabel(post: BlogPost) {
	const tags = new Set(post.tags);

	if (tags.has('books') || tags.has('book-reviews')) {
		return 'Book';
	}

	if (tags.has('show') || tags.has('shows') || tags.has('tv')) {
		return 'Show';
	}

	if (tags.has('movie') || tags.has('movies') || tags.has('film') || tags.has('films')) {
		return 'Movie';
	}

	if (tags.has('watching')) {
		return 'Watching';
	}

	return 'Media Note';
}

function toTimelineLinks(links: Array<{ label: string; url: string }>, limit = 3): TimelineLink[] {
	return (links || []).slice(0, limit).map((link) => ({
		label: link.label,
		url: link.url,
		external: true
	}));
}

function toPostTimelineItem(post: BlogPost): PostTimelineItem {
	return {
		id: `post-${post.slug}`,
		kind: 'post',
		label: getPostLabel(post),
		title: post.title,
		href: post.path,
		dateIso: post.publishedAt.toISOString(),
		dateLabel: formatTimelineDate(post.publishedAt),
		summary: post.excerpt || summarize(post.html),
		imageUrl: post.coverImage || null,
		imageAlt: post.title,
		tags: getPostTags(post)
	};
}

function toTrackTimelineItem(
	track: Awaited<ReturnType<typeof getTracks>>[number]
): TrackTimelineItem {
	return {
		id: `track-${track.slug}`,
		kind: 'track',
		label: 'Listening',
		title: track.trackTitle,
		href: track.localPath,
		dateIso: track.publishedAt.toISOString(),
		dateLabel: formatTimelineDate(track.publishedAt),
		summary: summarize(track.note || ''),
		imageUrl: track.artworkUrl || null,
		imageAlt: `${track.trackTitle} by ${track.artist}`,
		tags: [],
		artist: track.artist,
		audioUrl: track.previewUrl || null,
		links: toTimelineLinks(track.listenLinks)
	};
}

function toAlbumTimelineItem(
	album: Awaited<ReturnType<typeof getAlbums>>[number]
): AlbumTimelineItem {
	return {
		id: `album-${album.slug}`,
		kind: 'album',
		label: 'Album Rotation',
		title: album.albumTitle,
		href: album.localPath,
		dateIso: album.publishedAt.toISOString(),
		dateLabel: formatTimelineDate(album.publishedAt),
		summary: summarize(album.note || ''),
		imageUrl: album.coverImage || null,
		imageAlt: `${album.albumTitle} by ${album.artist}`,
		tags: [],
		artist: album.artist,
		links: toTimelineLinks(album.listenLinks)
	};
}

function getPopfeedLabel(item: Awaited<ReturnType<typeof getPopfeedItems>>[number]) {
	switch (item.type) {
		case 'book':
			return 'Book';
		case 'tv_show':
			return 'Show';
		default:
			return 'Movie';
	}
}

function toPopfeedTimelineItem(
	item: Awaited<ReturnType<typeof getPopfeedItems>>[number]
): PopfeedTimelineItem {
	return {
		id: `popfeed-${item.type}-${item.slug}`,
		kind: 'popfeed',
		label: getPopfeedLabel(item),
		title: item.title,
		href: item.localPath,
		dateIso: item.date.toISOString(),
		dateLabel: formatTimelineDate(item.date),
		summary: item.genres.slice(0, 4).join(', '),
		imageUrl: item.posterImage,
		fallbackImageUrl: null,
		imageAlt: item.mainCredit ? `${item.title} by ${item.mainCredit}` : item.title,
		tags: item.listTypeLabel ? [item.listTypeLabel] : [],
		credit: item.mainCredit,
		links: toTimelineLinks(item.links),
		mediaType: item.type
	};
}

async function getAllMediaTimelineItems() {
	const scope = getTimelineCache();
	const cached = scope.__afterwordMediaTimelineCache;

	if (cached && cached.expiresAt > Date.now()) {
		return cached.items;
	}

	const [bookPosts, screenPosts, albums, tracks, popfeedItems] = await Promise.all([
		getRecentTaggedPosts(BOOK_TAGS, 14),
		getRecentTaggedPosts(SCREEN_TAGS, 14),
		getAlbums(),
		getTracks(),
		getPopfeedItems()
	]);
	const items = [
		...dedupePosts([...bookPosts, ...screenPosts]).map(toPostTimelineItem),
		...tracks.map(toTrackTimelineItem),
		...albums.map(toAlbumTimelineItem),
		...popfeedItems.map(toPopfeedTimelineItem)
	].sort((left, right) => Date.parse(right.dateIso) - Date.parse(left.dateIso));

	scope.__afterwordMediaTimelineCache = {
		expiresAt: Date.now() + MEDIA_TIMELINE_CACHE_TTL_MS,
		items
	};

	return items;
}

export async function getMediaTimelinePage(
	offset = 0,
	limit = MEDIA_TIMELINE_PAGE_SIZE
): Promise<MediaTimelinePage> {
	const items = await getAllMediaTimelineItems();
	const safeLimit = Math.max(1, Math.min(limit, 40));
	const safeOffset = Math.max(0, offset);
	const pageItems = items.slice(safeOffset, safeOffset + safeLimit);
	const nextOffset = safeOffset + safeLimit < items.length ? safeOffset + safeLimit : null;

	return {
		items: pageItems,
		offset: safeOffset,
		limit: safeLimit,
		total: items.length,
		nextOffset
	};
}
