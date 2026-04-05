import { getAboutContent } from '$lib/server/content';

export function load() {
	return getAboutContent();
}
