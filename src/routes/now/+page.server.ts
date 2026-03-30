import { getCheckins, type Checkin } from '$lib/server/atproto';
import { getNowIntroContent } from '$lib/server/content';
import { getEarlierWebOnThisDayPosts } from '$lib/server/earlier-web';
import { getRecentTaggedPosts, type BlogPost } from '$lib/server/ghost';
import { getRecentManifestGalleryPhotos } from '$lib/server/photo-manifest';

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

export async function load(event) {
	const [intro, rawNowPosts, checkins, recentPhotos, onThisDayPosts] = await Promise.all([
		getNowIntroContent(),
		getRecentTaggedPosts(['now'], 12),
		getCheckins(),
		getRecentManifestGalleryPhotos(event, 1),
		getEarlierWebOnThisDayPosts(event)
	]);

	const nowPosts = rawNowPosts.filter((post: BlogPost) => !isMediaTagged(post));
	const latestCheckin =
		checkins
			.slice()
			.sort((a: Checkin, b: Checkin) => b.visitedAt.getTime() - a.visitedAt.getTime())[0] || null;

	return {
		intro,
		nowPosts,
		latestCheckin,
		latestPhoto: recentPhotos[0] || null,
		onThisDayPosts
	};
}
