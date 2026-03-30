import { error } from '@sveltejs/kit';
import { getAlbumBySlug, getAlbums } from '$lib/server/music';

export async function load(event) {
	const { params } = event;
	const [album, albums] = await Promise.all([getAlbumBySlug(params.slug, event), getAlbums(event)]);

	if (!album) {
		throw error(404, 'Album not found');
	}

	const index = albums.findIndex((item) => item.slug === album.slug);

	return {
		album,
		previousAlbum: index >= 0 ? albums[index + 1] || null : null,
		nextAlbum: index > 0 ? albums[index - 1] || null : null
	};
}
