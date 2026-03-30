import { json } from '@sveltejs/kit';
import { createJsonFeed, getStatusFeedEntries } from '$lib/server/feeds';

export async function GET(event) {
	const origin = event.url.origin;
	const items = await getStatusFeedEntries(origin);

	return json(
		createJsonFeed({
			title: 'Afterword Status',
			description: 'Short updates and notes from Afterword.',
			homePageUrl: `${origin}/status`,
			feedUrl: `${origin}/status/feed-public.json`,
			items
		}),
		{
			headers: {
				'cache-control': 'public, max-age=60'
			}
		}
	);
}
