import { json } from '@sveltejs/kit';
import { createJsonFeed, getEarlierWebFeedEntries } from '$lib/server/feeds';

export async function GET(event) {
	const items = await getEarlierWebFeedEntries(event);
	const origin = event.url.origin;

	return json(
		createJsonFeed({
			title: 'Earlier Web',
			description: 'Archive posts from earlier years on the web.',
			homePageUrl: `${origin}/earlier-web`,
			feedUrl: `${origin}/earlier-web/feed-public.json`,
			items
		}),
		{
			headers: {
				'cache-control': 'public, max-age=300'
			}
		}
	);
}
