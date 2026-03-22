import { getCheckins } from '$lib/server/atproto';
import { getNowIntroContent } from '$lib/server/content';
import { getLatestNowPost } from '$lib/server/ghost';
import { getAlbums, getTracks } from '$lib/server/music';

export async function load() {
	const [intro, nowPost, checkins, albums, tracks] = await Promise.all([
		getNowIntroContent(),
		getLatestNowPost(),
		getCheckins(),
		getAlbums(),
		getTracks()
	]);

	return {
		intro,
		nowPost,
		latestCheckin: checkins[0] || null,
		albums: albums.slice(0, 2),
		tracks: tracks.slice(0, 1)
	};
}
