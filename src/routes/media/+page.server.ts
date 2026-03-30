import { getSimplePageContent } from '$lib/server/content';

export async function load() {
	return {
		intro: await getSimplePageContent('media.md', 'Media')
	};
}
