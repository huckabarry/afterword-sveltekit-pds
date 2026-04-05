import { getAboutContent } from '$lib/server/content';
import { getSanityEditorialPage } from '$lib/server/sanity-site';

export const prerender = false;

export async function load() {
	const [content, page] = await Promise.all([Promise.resolve(getAboutContent()), getSanityEditorialPage('about')]);

	return {
		...content,
		page
	};
}
