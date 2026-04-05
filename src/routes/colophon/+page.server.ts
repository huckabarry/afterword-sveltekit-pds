import { getColophonContent } from '$lib/server/content';
import { renderMarkdown } from '$lib/server/markdown';
import { getCmsPageBySlug } from '$lib/server/site-cms';

export const prerender = false;

export async function load(event) {
	const fallback = getColophonContent();
	const page = await getCmsPageBySlug(event, 'colophon');

	return {
		title: page?.title || fallback.title,
		description: page?.description || fallback.description,
		html: renderMarkdown(page?.body || fallback.paragraphs.join('\n\n'))
	};
}
