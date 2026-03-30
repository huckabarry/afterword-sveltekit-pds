import { json } from '@sveltejs/kit';
import { createJsonFeed, getSiteWritingFeedEntries } from '$lib/server/feeds';

export async function GET(event) {
	const origin = event.url.origin;
	const items = await getSiteWritingFeedEntries(origin);

	return json(
		createJsonFeed({
			title: 'Afterword Writing',
			description: 'Field notes, planning posts, and other longer writing from Afterword.',
			homePageUrl: `${origin}/blog`,
			feedUrl: `${origin}/feed.json`,
			items
		}),
		{
			headers: {
				'cache-control': 'public, max-age=300'
			}
		}
	);
}
