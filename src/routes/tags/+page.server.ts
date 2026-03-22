import { getPublicTags } from '$lib/server/ghost';

export const prerender = false;

export async function load() {
	return {
		tags: await getPublicTags()
	};
}
