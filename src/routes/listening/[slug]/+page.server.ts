import { error } from '@sveltejs/kit';
import { getTrackBySlug, getTracks } from '$lib/server/music';

export async function load(event) {
	const { params } = event;
	const [track, tracks] = await Promise.all([getTrackBySlug(params.slug, event), getTracks(event)]);

	if (!track) {
		throw error(404, 'Track not found');
	}

	const index = tracks.findIndex((item) => item.slug === track.slug);

	return {
		track,
		previousTrack: index >= 0 ? tracks[index + 1] || null : null,
		nextTrack: index > 0 ? tracks[index - 1] || null : null
	};
}
