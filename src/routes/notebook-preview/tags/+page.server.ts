import { getJournalTags } from '$lib/server/journal';

export const prerender = false;

export async function load() {
	return {
		tags: await getJournalTags().catch(() => [])
	};
}
