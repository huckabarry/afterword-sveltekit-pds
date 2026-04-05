import { error } from '@sveltejs/kit';
import { getJournalEntryBySlug } from '$lib/server/journal';

export const prerender = false;

export async function load({ params }) {
	const entry = await getJournalEntryBySlug(params.slug);

	if (!entry) {
		throw error(404, 'Journal entry not found');
	}

	return {
		entry
	};
}
