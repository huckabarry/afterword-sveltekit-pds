import { json } from '@sveltejs/kit';
import { requireAccessToken } from '$lib/server/mastodon-auth';
import { getInstanceOrigin, getMastodonAccount } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireAccessToken(event);
	return json(getMastodonAccount(getInstanceOrigin(event.url)));
}
