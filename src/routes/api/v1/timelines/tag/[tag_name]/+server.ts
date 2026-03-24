import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';

export async function GET(event) {
	await requireMastodonAccessToken(event);
	return json([], {
		headers: {
			'cache-control': 'no-store'
		}
	});
}
