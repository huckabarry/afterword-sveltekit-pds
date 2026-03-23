import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { decodeMastodonAccountId, resolveAccountByIdOrAcct } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);
	const actorId = decodeMastodonAccountId(event.params.id) || event.params.id;
	return json(await resolveAccountByIdOrAcct(event, actorId));
}
