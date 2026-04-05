import { attachMediaCoverDelivery } from '$lib/server/media-cover-delivery';
import { getSimplePageContent } from '$lib/server/content';
import { getSanityRouteIntro, SANITY_PUBLIC_CACHE_CONTROL } from '$lib/server/sanity-site';
import { getMediaTimelinePage, MEDIA_TIMELINE_PAGE_SIZE } from '$lib/server/media-timeline';

export const prerender = false;

export async function load(event) {
	event.setHeaders({
		'cache-control': SANITY_PUBLIC_CACHE_CONTROL
	});

	const [fallbackIntro, sanityIntro, initialTimelinePage] = await Promise.all([
		getSimplePageContent('media.md', 'Media'),
		getSanityRouteIntro('media'),
		getMediaTimelinePage(event, 0, MEDIA_TIMELINE_PAGE_SIZE)
	]);

	return {
		intro: sanityIntro || fallbackIntro,
		initialTimelinePage: attachMediaCoverDelivery(initialTimelinePage, event)
	};
}
