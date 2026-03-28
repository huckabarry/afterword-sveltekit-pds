import { error } from '@sveltejs/kit';
import { getPopfeedItemBySlug, getPopfeedItemsByType } from '$lib/server/popfeed';

export async function load({ params }) {
	const [item, items] = await Promise.all([
		getPopfeedItemBySlug('tv_show', params.slug),
		getPopfeedItemsByType('tv_show')
	]);

	if (!item) {
		throw error(404, 'Show not found');
	}

	const index = items.findIndex((entry) => entry.slug === item.slug);

	return {
		item,
		previousItem: index >= 0 ? items[index + 1] || null : null,
		nextItem: index > 0 ? items[index - 1] || null : null
	};
}
