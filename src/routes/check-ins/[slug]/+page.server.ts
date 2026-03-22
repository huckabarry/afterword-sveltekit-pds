import { error } from '@sveltejs/kit';
import { getCheckinBySlug, getCheckins } from '$lib/server/atproto';

export async function load({ params }) {
	const [item, checkins] = await Promise.all([getCheckinBySlug(params.slug), getCheckins()]);

	if (!item) {
		throw error(404, 'Check-in not found');
	}

	const currentIndex = checkins.findIndex((entry) => entry.slug === params.slug);

	return {
		item,
		previousItem: currentIndex >= 0 ? checkins[currentIndex + 1] || null : null,
		nextItem: currentIndex >= 0 ? checkins[currentIndex - 1] || null : null
	};
}
