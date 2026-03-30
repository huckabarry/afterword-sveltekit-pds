import { createRssFeed, getEarlierWebFeedEntries } from '$lib/server/feeds';

export async function GET(event) {
	const origin = event.url.origin;
	const items = await getEarlierWebFeedEntries(event);
	const body = createRssFeed({
		title: 'Earlier Web',
		description: 'Archive posts from earlier years on the web.',
		homePageUrl: `${origin}/earlier-web`,
		feedUrl: `${origin}/earlier-web/feed.xml`,
		items
	});

	return new Response(body, {
		headers: {
			'content-type': 'application/rss+xml; charset=utf-8',
			'cache-control': 'public, max-age=300'
		}
	});
}
