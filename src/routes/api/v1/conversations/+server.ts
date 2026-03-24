import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { listMastodonConversations } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);
	const limit = Number(event.url.searchParams.get('limit') || '20');
	return json(await listMastodonConversations(event, limit));
}
