import { getCheckins, type Checkin } from '$lib/server/atproto';
import { getLatestCheckinSnapshot } from '$lib/server/checkin-snapshot';
import { getNowIntroContent } from '$lib/server/content';
import { getEarlierWebOnThisDayPosts } from '$lib/server/earlier-web';
import { getNowPosts, getPhotoItems, type BlogPost } from '$lib/server/ghost';
import { attachGalleryAssetUrls } from '$lib/server/gallery-assets';
import { getTracks, type TrackEntry } from '$lib/server/music';
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
	const [intro, rawNowPosts, latestCheckinSnapshot, recentPhotos, onThisDayPosts, tracks] = await Promise.all([
		getNowIntroContent(),
		getNowPosts(),
		getLatestCheckinSnapshot(event),
		getRecentManifestGalleryPhotos(event, 1),
		getEarlierWebOnThisDayPosts(event, new Date(), 3, { sourceType: 'instagram' }),
		getTracks(event)
	]);

	const nowPosts = rawNowPosts.filter((post: BlogPost) => !isMediaTagged(post)).slice(0, 12);
	const fallbackPhotos = await attachGalleryAssetUrls(
		(await getPhotoItems()).sort(
			(a, b) => b.postPublishedAt.getTime() - a.postPublishedAt.getTime() || a.index - b.index
		),
		event.platform?.env.R2_BUCKET
	);
	const latestPhoto =
		recentPhotos[0] ||
		fallbackPhotos[0] ||
		null;
	const latestCheckin =
		latestCheckinSnapshot ||
		(await getCheckins())
			.slice()
			.sort((a: Checkin, b: Checkin) => b.visitedAt.getTime() - a.visitedAt.getTime())[0] ||
		null;

	return {
		intro,
		nowPosts,
		latestTrack: tracks[0] || null,
		latestCheckin,
		latestPhoto,
		onThisDayPosts
	};
}
