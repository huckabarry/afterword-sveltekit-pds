import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { resolveAccountByIdOrAcct } from '$lib/server/mastodon-api';
import { listBlockedActorIds } from '$lib/server/mastodon-state';

export async function GET(event) {
	await requireMastodonAccessToken(event);
	const actorIds = await listBlockedActorIds(event, 80);
	return json(
		(await Promise.all(actorIds.map((actorId: string) => resolveAccountByIdOrAcct(event, actorId)))).filter(Boolean)
	);
}
