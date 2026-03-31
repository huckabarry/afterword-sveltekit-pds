import { getCheckins, type Checkin } from '$lib/server/atproto';
import { getLatestCheckinSnapshot } from '$lib/server/checkin-snapshot';
import { getNowIntroContent } from '$lib/server/content';
import { getEarlierWebOnThisDayPosts } from '$lib/server/earlier-web';
import { getNowPosts, type BlogPost } from '$lib/server/ghost';
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
	const [intro, rawNowPosts, latestCheckinSnapshot, recentPhotos, onThisDayPosts] = await Promise.all([
		getNowIntroContent(),
		getNowPosts(),
		getLatestCheckinSnapshot(event),
		getRecentManifestGalleryPhotos(event, 1),
		getEarlierWebOnThisDayPosts(event, new Date(), 3, { sourceType: 'instagram' })
	]);

	const nowPosts = rawNowPosts.filter((post: BlogPost) => !isMediaTagged(post)).slice(0, 12);
	const latestCheckin =
		latestCheckinSnapshot ||
		(await getCheckins())
			.slice()
			.sort((a: Checkin, b: Checkin) => b.visitedAt.getTime() - a.visitedAt.getTime())[0] ||
		null;

	return {
		intro,
		nowPosts,
		latestCheckin,
		latestPhoto: recentPhotos[0] || null,
		onThisDayPosts
	};
}
