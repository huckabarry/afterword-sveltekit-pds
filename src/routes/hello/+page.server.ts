import { renderMarkdown } from '$lib/server/markdown';
import { getCmsPageBySlug, getEditablePageSeed } from '$lib/server/site-cms';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const page = (await getCmsPageBySlug(event, 'hello')) || getEditablePageSeed('hello');

	return {
		title: page?.title || 'Hello',
		description:
			page?.description ||
			'A short guide to what Afterword is, what Bryan writes about, and the best ways to say hello.',
		html: renderMarkdown(page?.body || '')
	};
};
