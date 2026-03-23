import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { listMastodonNotifications } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);
	const limit = Math.max(1, Math.min(Number.parseInt(event.url.searchParams.get('limit') || '20', 10) || 20, 40));

	return json(await listMastodonNotifications(event, limit), {
		headers: {
			'cache-control': 'no-store'
		}
	});
}
