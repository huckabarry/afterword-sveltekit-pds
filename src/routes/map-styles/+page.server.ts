import { getCheckins } from '$lib/server/atproto';
import { filterPublicCheckins } from '$lib/server/checkin-visibility';

export async function load() {
	const checkins = filterPublicCheckins(await getCheckins());
	return {
		item: checkins[0] || null
	};
}
