import { getCheckins, type Checkin } from '$lib/server/atproto';
import { getLatestCheckinSnapshot } from '$lib/server/checkin-snapshot';
import { filterPublicCheckins, isPublicCheckin } from '$lib/server/checkin-visibility';
import { getNowIntroContent } from '$lib/server/content';
import { getEarlierWebOnThisDayPosts } from '$lib/server/earlier-web';
import { getNowPosts, getPhotoItems, type BlogPost } from '$lib/server/ghost';
import {
	attachGalleryAssetUrls,
	getGalleryDeliveryUrls
} from '$lib/server/gallery-assets';
import { getTracks, type TrackEntry } from '$lib/server/music';
import { getRecentManifestGalleryPhotos } from '$lib/server/photo-manifest';
import { getSanityRouteIntro, SANITY_PUBLIC_CACHE_CONTROL } from '$lib/server/sanity-site';

export const prerender = false;

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
	event.setHeaders({
		'cache-control': SANITY_PUBLIC_CACHE_CONTROL
	});

	const [fallbackIntro, sanityIntro, rawNowPosts, latestCheckinSnapshot, recentPhotos, onThisDayPosts, tracks, liveCheckins] = await Promise.all([
		getNowIntroContent(),
		getSanityRouteIntro('now'),
		getNowPosts(),
		getLatestCheckinSnapshot(event),
		getRecentManifestGalleryPhotos(event, 1),
		getEarlierWebOnThisDayPosts(event, new Date(), 3, { sourceType: 'instagram' }),
		getTracks(event),
		getCheckins().catch(() => [])
	]);

	const nowPosts = rawNowPosts.filter((post: BlogPost) => !isMediaTagged(post)).slice(0, 12);
	let galleryBucket = null;

	try {
		galleryBucket = event.platform?.env?.R2_BUCKET ?? null;
	} catch {
		galleryBucket = null;
	}

	const fallbackPhotos = await attachGalleryAssetUrls(
		(await getPhotoItems()).sort(
			(a, b) => b.postPublishedAt.getTime() - a.postPublishedAt.getTime() || a.index - b.index
		),
		galleryBucket
	);
	const latestPhoto =
		(recentPhotos[0]
			? {
					...recentPhotos[0],
					...getGalleryDeliveryUrls(
						recentPhotos[0].assetKey,
						recentPhotos[0].imageUrl,
						recentPhotos[0].isSyncedToR2
					)
				}
			: null) ||
		fallbackPhotos[0] ||
		null;
	const latestCheckin =
		filterPublicCheckins(liveCheckins)
			.slice()
			.sort((a: Checkin, b: Checkin) => b.visitedAt.getTime() - a.visitedAt.getTime())[0] ||
		(isPublicCheckin(latestCheckinSnapshot) ? latestCheckinSnapshot : null) ||
		null;

	return {
		intro: sanityIntro || fallbackIntro,
		nowPosts,
		latestTrack: tracks[0] || null,
		latestCheckin,
		latestPhoto,
		onThisDayPosts
	};
}
