import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { getMastodonNotificationsPolicy } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	return json(getMastodonNotificationsPolicy(), {
		headers: {
			'cache-control': 'no-store'
		}
	});
}

export async function PATCH(event) {
	await requireMastodonAccessToken(event);
	await event.request.json().catch(() => ({}));

	return json(getMastodonNotificationsPolicy(), {
		headers: {
			'cache-control': 'no-store'
		}
	});
}
