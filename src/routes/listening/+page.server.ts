import { getTracks } from '$lib/server/music';

export async function load(event) {
	return {
		tracks: await getTracks(event)
	};
}
