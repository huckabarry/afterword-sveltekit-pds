import { getStatuses } from '$lib/server/atproto';

export async function load() {
	return {
		statuses: await getStatuses()
	};
}
