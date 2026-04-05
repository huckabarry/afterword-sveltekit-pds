import { createRssFeed, getMediaFeedEntries } from '$lib/server/feeds';

export async function GET(event) {
	const origin = event.url.origin;
	const items = await getMediaFeedEntries(event);
	const body = createRssFeed({
		title: 'Afterword Media',
		description: 'Albums, songs, books, movies, and shows from Afterword.',
		homePageUrl: `${origin}/media`,
		feedUrl: `${origin}/media/feed.xml`,
		items
	});

	return new Response(body, {
		headers: {
			'content-type': 'application/rss+xml; charset=utf-8',
			'cache-control': 'public, max-age=60'
		}
	});
}
