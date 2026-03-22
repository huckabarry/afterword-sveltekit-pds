import { getTracks } from '$lib/server/music';

export async function load() {
	return {
		tracks: await getTracks()
	};
}
