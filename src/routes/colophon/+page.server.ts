import { getColophonContent } from '$lib/server/content';
import { getSanityEditorialPage } from '$lib/server/sanity-site';

export const prerender = false;

export async function load() {
	const [content, page] = await Promise.all([
		Promise.resolve(getColophonContent()),
		getSanityEditorialPage('colophon')
	]);

	return {
		...content,
		page
	};
}
