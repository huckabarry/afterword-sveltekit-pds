import { getCheckins } from '$lib/server/atproto';
import { getNowIntroContent } from '$lib/server/content';
import { getAlbums, getTracks } from '$lib/server/music';

export async function load() {
	const [intro, checkins, albums, tracks] = await Promise.all([
		getNowIntroContent(),
		getCheckins(),
		getAlbums(),
		getTracks()
	]);

	return {
		intro,
		latestCheckin: checkins[0] || null,
		albums: albums.slice(0, 2),
		tracks: tracks.slice(0, 1)
	};
}
