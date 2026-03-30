import { getSimplePageContent } from '$lib/server/content';
import { attachMediaCoverDelivery } from '$lib/server/media-cover-delivery';
import { getMediaTimelinePage, MEDIA_TIMELINE_PAGE_SIZE } from '$lib/server/media-timeline';

export async function load(event) {
	const [intro, timeline] = await Promise.all([
		getSimplePageContent('media.md', 'Media'),
		getMediaTimelinePage(event, 0, MEDIA_TIMELINE_PAGE_SIZE)
	]);

	return {
		intro,
		timeline: attachMediaCoverDelivery(timeline, event)
	};
}
