import { getGallerySnapshot } from '$lib/server/gallery-snapshot';
import { getSanityRouteIntro } from '$lib/server/sanity-site';

export const prerender = false;

export async function load(event) {
	const [photos, intro] = await Promise.all([
		getGallerySnapshot(event),
		getSanityRouteIntro('photos')
	]);

	return {
		intro: intro || {
			title: 'Visual Notes',
			description: 'A gallery of photographs, street scenes, landscapes, and visual notes.',
			paragraphs: [
				"Most of these are photos of places I've visited, street scenes, and landscapes. Photography is just a hobby for me, and I'm still learning and trying new things. It's just another way for me to express myself."
			]
		},
		photos
	};
}
