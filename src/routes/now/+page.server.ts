import { getCheckins } from '$lib/server/atproto';
import { getNowIntroContent } from '$lib/server/content';
import { getRecentTaggedPosts } from '$lib/server/ghost';
import { getAlbums, getTracks } from '$lib/server/music';

export async function load() {
	const [intro, nowPosts, bookPosts, checkins, albums, tracks] = await Promise.all([
		getNowIntroContent(),
		getRecentTaggedPosts(['now'], 12),
		getRecentTaggedPosts(['books', 'book-reviews'], 8),
		getCheckins(),
		getAlbums(),
		getTracks()
	]);

	const bookIds = new Set(bookPosts.map((post) => post.id));

	return {
		intro,
		nowPosts: nowPosts.filter((post) => !bookIds.has(post.id)),
		bookPosts,
		checkins,
		albums,
		tracks
	};
}
