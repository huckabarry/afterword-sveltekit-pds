import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { buildPublicTimeline, filterMastodonStatuses } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const limit = Number(event.url.searchParams.get('limit') || '20');
	const local = event.url.searchParams.get('local') === 'true';
	const statuses = await buildPublicTimeline(event, {
		limit: Math.max(limit * 2, 40),
		local
	});

	return json(
		filterMastodonStatuses(statuses, {
			maxId: event.url.searchParams.get('max_id'),
			sinceId: event.url.searchParams.get('since_id'),
			minId: event.url.searchParams.get('min_id'),
			limit
		}),
		{
			headers: {
				'cache-control': 'no-store'
			}
		}
	);
}
