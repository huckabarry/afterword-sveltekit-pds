import { error } from '@sveltejs/kit';
import { getPopfeedItemBySlug, getPopfeedItemsByType } from '$lib/server/popfeed';

export async function load({ params }) {
	const [item, items] = await Promise.all([
		getPopfeedItemBySlug('movie', params.slug),
		getPopfeedItemsByType('movie')
	]);

	if (!item) {
		throw error(404, 'Movie not found');
	}

	const index = items.findIndex((entry) => entry.slug === item.slug);

	return {
		item,
		previousItem: index >= 0 ? items[index + 1] || null : null,
		nextItem: index > 0 ? items[index - 1] || null : null
	};
}
