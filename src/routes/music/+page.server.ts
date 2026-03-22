import { getAlbums } from '$lib/server/music';

export async function load() {
	return {
		albums: await getAlbums()
	};
}
