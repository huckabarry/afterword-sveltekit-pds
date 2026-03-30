import { getCheckins } from '$lib/server/atproto';
import { getNowIntroContent } from '$lib/server/content';
import { getEarlierWebOnThisDayPosts } from '$lib/server/earlier-web';
import { getPhotoItems, getRecentTaggedPosts, type BlogPost, type PhotoItem } from '$lib/server/ghost';

const MEDIA_TAGS = new Set([
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

function isMediaTagged(post: BlogPost) {
	return post.tags.some((tag) => MEDIA_TAGS.has(tag));
}

function getLatestPhoto(photos: PhotoItem[]) {
	return photos
		.slice()
		.sort((a, b) => {
			const dateDelta = b.postPublishedAt.getTime() - a.postPublishedAt.getTime();
			if (dateDelta !== 0) return dateDelta;
			return a.index - b.index;
		})[0] || null;
}

export async function load(event) {
	const [intro, rawNowPosts, checkins, photos, onThisDayPosts] = await Promise.all([
		getNowIntroContent(),
		getRecentTaggedPosts(['now'], 12),
		getCheckins(),
		getPhotoItems(),
		getEarlierWebOnThisDayPosts(event)
	]);

	const nowPosts = rawNowPosts.filter((post) => !isMediaTagged(post));
	const latestCheckin =
		checkins
			.slice()
			.sort((a, b) => b.visitedAt.getTime() - a.visitedAt.getTime())[0] || null;

	return {
		intro,
		nowPosts,
		latestCheckin,
		latestPhoto: getLatestPhoto(photos),
		onThisDayPosts
	};
}
