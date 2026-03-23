import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { buildLocalAccount } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);
	return json(await buildLocalAccount(event));
}
