import { getSimplePageContent } from '$lib/server/content';
import { getMediaTimelinePage, MEDIA_TIMELINE_PAGE_SIZE } from '$lib/server/media-timeline';

export async function load() {
	const [intro, timeline] = await Promise.all([
		getSimplePageContent('media.md', 'Media'),
		getMediaTimelinePage(0, MEDIA_TIMELINE_PAGE_SIZE)
	]);

	return {
		intro,
		timeline
	};
}
