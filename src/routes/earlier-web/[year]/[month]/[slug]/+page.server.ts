import { error } from '@sveltejs/kit';
import { getEarlierWebPost } from '$lib/server/earlier-web';
import type { PageServerLoad } from './$types';

function parseNumber(value: string, min: number, max: number) {
	const parsed = Number.parseInt(value, 10);
	return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export const load: PageServerLoad = async (event) => {
	const year = parseNumber(event.params.year, 1900, 2100);
	const month = parseNumber(event.params.month, 1, 12);

	if (!year || !month) {
		throw error(404, 'Archive post not found');
	}

	const post = await getEarlierWebPost(event, year, month, event.params.slug);

	if (!post) {
		throw error(404, 'Archive post not found');
	}

	return {
		post
	};
};
