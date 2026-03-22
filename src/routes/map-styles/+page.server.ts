import { getCheckins } from '$lib/server/atproto';

export async function load() {
	const checkins = await getCheckins();
	return {
		item: checkins[0] || null
	};
}
