import { getAboutContent } from '$lib/server/content';
import { getSanityEditorialPage, SANITY_PUBLIC_CACHE_CONTROL } from '$lib/server/sanity-site';

export const prerender = false;

export async function load(event) {
	event.setHeaders({
		'cache-control': SANITY_PUBLIC_CACHE_CONTROL
	});

	const [content, page] = await Promise.all([Promise.resolve(getAboutContent()), getSanityEditorialPage('about')]);

	return {
		...content,
		page
	};
}
