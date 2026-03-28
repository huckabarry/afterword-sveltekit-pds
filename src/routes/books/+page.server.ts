import { getPopfeedItemsByType } from '$lib/server/popfeed';

export async function load() {
	return {
		items: await getPopfeedItemsByType('book')
	};
}
