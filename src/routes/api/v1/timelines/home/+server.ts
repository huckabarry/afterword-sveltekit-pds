import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { buildHomeTimeline, filterMastodonStatuses } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);
	const limit = Math.max(1, Math.min(Number.parseInt(event.url.searchParams.get('limit') || '20', 10) || 20, 40));
	const statuses = await buildHomeTimeline(event, Math.max(limit * 2, 40));
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
