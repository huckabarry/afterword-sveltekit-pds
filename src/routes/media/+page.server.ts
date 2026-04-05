import { attachMediaCoverDelivery } from '$lib/server/media-cover-delivery';
import { getSimplePageContent } from '$lib/server/content';
import { getMediaTimelinePage, MEDIA_TIMELINE_PAGE_SIZE } from '$lib/server/media-timeline';

export async function load(event) {
	const [intro, initialTimelinePage] = await Promise.all([
		getSimplePageContent('media.md', 'Media'),
		getMediaTimelinePage(event, 0, MEDIA_TIMELINE_PAGE_SIZE)
	]);

	return {
		intro,
		initialTimelinePage: attachMediaCoverDelivery(initialTimelinePage, event)
	};
}
