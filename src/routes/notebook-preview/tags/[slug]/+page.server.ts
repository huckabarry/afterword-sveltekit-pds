import { error } from '@sveltejs/kit';
import { getJournalEntriesByTagSlug, getJournalTagBySlug } from '$lib/server/journal';

export const prerender = false;

export async function load({ params }) {
	const [tag, entries] = await Promise.all([
		getJournalTagBySlug(params.slug),
		getJournalEntriesByTagSlug(params.slug).catch(() => [])
	]);

	if (!tag) {
		throw error(404, 'Notebook tag not found');
	}

	return {
		tag,
		entries
	};
}
