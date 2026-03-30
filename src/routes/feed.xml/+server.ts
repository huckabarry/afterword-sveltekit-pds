import { createRssFeed, getSiteWritingFeedEntries } from '$lib/server/feeds';

export async function GET(event) {
	const origin = event.url.origin;
	const items = await getSiteWritingFeedEntries(origin);
	const body = createRssFeed({
		title: 'Afterword Writing',
		description: 'Field notes, planning posts, and other longer writing from Afterword.',
		homePageUrl: `${origin}/blog`,
		feedUrl: `${origin}/feed.xml`,
		items
	});

	return new Response(body, {
		headers: {
			'content-type': 'application/rss+xml; charset=utf-8',
			'cache-control': 'public, max-age=300'
		}
	});
}
