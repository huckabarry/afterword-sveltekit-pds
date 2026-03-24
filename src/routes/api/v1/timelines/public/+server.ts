import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { buildPublicTimeline } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const limit = Number(event.url.searchParams.get('limit') || '20');
	const local = event.url.searchParams.get('local') === 'true';
	const statuses = await buildPublicTimeline(event, {
		limit,
		local
	});

	return json(statuses, {
		headers: {
			'cache-control': 'no-store'
		}
	});
}
