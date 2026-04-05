import { getSanityEditorialPage, SANITY_PUBLIC_CACHE_CONTROL } from '$lib/server/sanity-site';

export const prerender = false;

export async function load(event) {
	event.setHeaders({
		'cache-control': SANITY_PUBLIC_CACHE_CONTROL
	});

	return {
		page: await getSanityEditorialPage('hello')
	};
}
