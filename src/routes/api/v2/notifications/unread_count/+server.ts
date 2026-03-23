import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { listMastodonNotifications } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);
	const notifications = await listMastodonNotifications(event, 80);

	return json({
		count: notifications.length
	}, {
		headers: {
			'cache-control': 'no-store'
		}
	});
}
