import { json } from '@sveltejs/kit';
import { createJsonFeed, getPlanningFeedEntries } from '$lib/server/feeds';

export async function GET(event) {
	const origin = event.url.origin;
	const items = await getPlanningFeedEntries(origin);

	return json(
		createJsonFeed({
			title: 'Afterword Planning',
			description: 'Planning and urbanism posts from Afterword.',
			homePageUrl: `${origin}/planning`,
			feedUrl: `${origin}/planning/feed.json`,
			items
		}),
		{
			headers: {
				'cache-control': 'public, max-age=300'
			}
		}
	);
}
