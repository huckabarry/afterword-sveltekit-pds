import { getCheckins } from '$lib/server/atproto';

export async function load() {
	return {
		checkins: await getCheckins()
	};
}
