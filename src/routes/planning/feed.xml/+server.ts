import { createRssFeed, getPlanningFeedEntries } from '$lib/server/feeds';

export async function GET(event) {
	const origin = event.url.origin;
	const items = await getPlanningFeedEntries(origin);
	const body = createRssFeed({
		title: 'Afterword Planning',
		description: 'Planning and urbanism posts from Afterword.',
		homePageUrl: `${origin}/planning`,
		feedUrl: `${origin}/planning/feed.xml`,
		items
	});

	return new Response(body, {
		headers: {
			'content-type': 'application/rss+xml; charset=utf-8',
			'cache-control': 'public, max-age=300'
		}
	});
}
