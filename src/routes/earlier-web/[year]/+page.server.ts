import { error } from '@sveltejs/kit';
import { getEarlierWebYearPosts } from '$lib/server/earlier-web';
import type { PageServerLoad } from './$types';

function toYear(value: string) {
	const year = Number.parseInt(value, 10);
	return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}

export const load: PageServerLoad = async (event) => {
	const year = toYear(event.params.year);

	if (!year) {
		throw error(404, 'Archive year not found');
	}

	const posts = await getEarlierWebYearPosts(event, year);

	if (!posts.length) {
		throw error(404, 'Archive year not found');
	}

	return {
		year,
		posts
	};
};
