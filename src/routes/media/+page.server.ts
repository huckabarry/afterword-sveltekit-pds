import { getSimplePageContent } from '$lib/server/content';
import { getRecentTaggedPosts, type BlogPost } from '$lib/server/ghost';
import { getAlbums, getTracks } from '$lib/server/music';
import { getPopfeedItems } from '$lib/server/popfeed';

const BOOK_TAGS = ['books', 'book-reviews'];
const SCREEN_TAGS = ['movie', 'movies', 'film', 'films', 'show', 'shows', 'tv', 'watching'];

function dedupePosts(posts: BlogPost[]) {
	return [...new Map(posts.map((post) => [post.id, post])).values()].sort(
		(a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
	);
}

export async function load() {
	const [intro, bookPosts, screenPosts, albums, tracks, popfeedItems] = await Promise.all([
		getSimplePageContent('media.md', 'Media'),
		getRecentTaggedPosts(BOOK_TAGS, 14),
		getRecentTaggedPosts(SCREEN_TAGS, 14),
		getAlbums(),
		getTracks(),
		getPopfeedItems()
	]);

	return {
		intro,
		posts: dedupePosts([...bookPosts, ...screenPosts]),
		albums,
		tracks,
		popfeedItems
	};
}
