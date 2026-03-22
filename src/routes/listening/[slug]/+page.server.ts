import { error } from '@sveltejs/kit';
import { getTrackBySlug, getTracks } from '$lib/server/music';

export async function load({ params }) {
	const [track, tracks] = await Promise.all([getTrackBySlug(params.slug), getTracks()]);

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
