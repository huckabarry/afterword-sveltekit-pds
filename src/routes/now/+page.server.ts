import { getCheckins } from '$lib/server/atproto';
import { getNowIntroContent } from '$lib/server/content';
import { getLatestNowPost, getPostImages, stripImagesFromHtml } from '$lib/server/ghost';
import { getAlbums, getTracks } from '$lib/server/music';

export async function load() {
	const [intro, nowPost, checkins, albums, tracks] = await Promise.all([
		getNowIntroContent(),
		getLatestNowPost(),
		getCheckins(),
		getAlbums(),
		getTracks()
	]);

	const nowImages = nowPost ? getPostImages(nowPost) : [];
	const nowContentHtml =
		nowPost && nowImages.length > 1 ? stripImagesFromHtml(nowPost.html) : (nowPost?.html ?? '');

	return {
		intro,
		nowPost,
		nowImages,
		nowContentHtml,
		latestCheckin: checkins[0] || null,
		albums: albums.slice(0, 8),
		tracks: tracks.slice(0, 1)
	};
}
