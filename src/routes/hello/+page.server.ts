import { getSanityEditorialPage } from '$lib/server/sanity-site';

export const prerender = false;

export async function load() {
	return {
		page: await getSanityEditorialPage('hello')
	};
}
