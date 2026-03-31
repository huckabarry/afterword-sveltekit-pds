import { getAboutContent } from '$lib/server/content';

export const prerender = false;

export function load() {
	return getAboutContent();
}
