import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { listGroupedMastodonNotifications } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);
	const limit = Math.max(1, Math.min(Number.parseInt(event.url.searchParams.get('limit') || '20', 10) || 20, 40));
	const types = event.url.searchParams.getAll('types[]').concat(event.url.searchParams.getAll('types'));
	const excludeTypes = event.url.searchParams
		.getAll('exclude_types[]')
		.concat(event.url.searchParams.getAll('exclude_types'));

	return json(await listGroupedMastodonNotifications(event, limit, { types, excludeTypes }), {
		headers: {
			'cache-control': 'no-store'
		}
	});
}
