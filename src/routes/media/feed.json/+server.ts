import { json } from '@sveltejs/kit';
import { createJsonFeed, getMediaFeedEntries } from '$lib/server/feeds';

export async function GET(event) {
	const origin = event.url.origin;
	const items = await getMediaFeedEntries(event);

	return json(
		createJsonFeed({
			title: 'Afterword Media',
			description: 'Albums, songs, books, movies, and shows from Afterword.',
			homePageUrl: `${origin}/media`,
			feedUrl: `${origin}/media/feed.json`,
			items
		}),
		{
			headers: {
				'cache-control': 'public, max-age=60'
			}
		}
	);
}
