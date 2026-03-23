import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { searchAccounts } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const q = event.url.searchParams.get('q')?.trim() || '';
	const resolve = event.url.searchParams.get('resolve') !== 'false';
	const followingOnly = event.url.searchParams.get('following') === 'true';
	const limit = Math.max(1, Math.min(Number.parseInt(event.url.searchParams.get('limit') || '20', 10) || 20, 40));

	return json(await searchAccounts(event, q, { resolve, limit, followingOnly }));
}
