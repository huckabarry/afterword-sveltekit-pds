import { getAlbums } from '$lib/server/music';

export async function load(event) {
	return {
		albums: await getAlbums(event)
	};
}
