import { createRssFeed, getEverythingFeedEntries } from '$lib/server/feeds';

export async function GET(event) {
	const origin = event.url.origin;
	const items = await getEverythingFeedEntries(event);
	const body = createRssFeed({
		title: 'Afterword Everything',
		description: 'A unified public feed from Afterword: writing, status, media, check-ins, and archive posts.',
		homePageUrl: `${origin}/`,
		feedUrl: `${origin}/everything/feed.xml`,
		items
	});

	return new Response(body, {
		headers: {
			'content-type': 'application/rss+xml; charset=utf-8',
			'cache-control': 'public, max-age=60'
		}
	});
}
