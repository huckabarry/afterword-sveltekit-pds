import { getCheckins } from '$lib/server/atproto';
import { getNowIntroContent } from '$lib/server/content';
import { getRecentTaggedPosts } from '$lib/server/ghost';
import { getAlbums, getTracks } from '$lib/server/music';

export async function load() {
	const [intro, nowPosts, bookPosts, checkins, albums, tracks] = await Promise.all([
		getNowIntroContent(),
		getRecentTaggedPosts(['now'], 5),
		getRecentTaggedPosts(['books', 'book-reviews'], 3),
		getCheckins(),
		getAlbums(),
		getTracks()
	]);

	const bookIds = new Set(bookPosts.map((post) => post.id));

	return {
		intro,
		nowPosts: nowPosts.filter((post) => !bookIds.has(post.id)).slice(0, 4),
		bookPosts: bookPosts.slice(0, 2),
		checkins: checkins.slice(0, 4),
		albums: albums.slice(0, 3),
		tracks: tracks.slice(0, 3)
	};
}
