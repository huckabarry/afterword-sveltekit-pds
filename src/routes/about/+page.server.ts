import { getAboutContent } from '$lib/server/content';

export function load({ url }) {
	if (url.hostname === 'svelte.afterword.blog') {
		return {
			simplePage: true
		};
	}

	return getAboutContent();
}
