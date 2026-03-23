import { error, json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { resolveAccountByIdOrAcct } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const acct = event.url.searchParams.get('acct')?.trim() || '';
	if (!acct) {
		throw error(422, 'acct is required');
	}

	return json(await resolveAccountByIdOrAcct(event, acct));
}
