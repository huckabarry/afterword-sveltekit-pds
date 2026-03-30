import { createRssFeed, getStatusFeedEntries } from '$lib/server/feeds';

export async function GET(event) {
	const origin = event.url.origin;
	const items = await getStatusFeedEntries(origin);
	const body = createRssFeed({
		title: 'Afterword Status',
		description: 'Short updates and notes from Afterword.',
		homePageUrl: `${origin}/status`,
		feedUrl: `${origin}/status/feed.xml`,
		items
	});

	return new Response(body, {
		headers: {
			'content-type': 'application/rss+xml; charset=utf-8',
			'cache-control': 'public, max-age=60'
		}
	});
}
