import { json } from '@sveltejs/kit';
import { createJsonFeed, getEverythingFeedEntries } from '$lib/server/feeds';

export async function GET(event) {
	const origin = event.url.origin;
	const items = await getEverythingFeedEntries(event);

	return json(
		createJsonFeed({
			title: 'Afterword Everything',
			description: 'A unified public feed from Afterword: writing, status, media, check-ins, and archive posts.',
			homePageUrl: `${origin}/`,
			feedUrl: `${origin}/everything/feed.json`,
			items
		}),
		{
			headers: {
				'cache-control': 'public, max-age=60'
			}
		}
	);
}
