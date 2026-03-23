import { json } from '@sveltejs/kit';
import { getActorId, getActivityPubOrigin } from '$lib/server/activitypub';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { followRemoteActor } from '$lib/server/activitypub-follows';
import {
	buildRelationship,
	decodeMastodonAccountId,
	resolveAccountByIdOrAcct
} from '$lib/server/mastodon-api';

export async function POST(event) {
	await requireMastodonAccessToken(event);

	const origin = getActivityPubOrigin(event);
	const localActorId = getActorId(origin);
	const actorId = decodeMastodonAccountId(event.params.id) || event.params.id;

	if (actorId !== localActorId) {
		await followRemoteActor(event, actorId);
	}

	const account = await resolveAccountByIdOrAcct(event, actorId);
	const meta =
		account && typeof account === 'object' && '_afterwordRelationship' in account
			? (account as { _afterwordRelationship?: { following: boolean; followedBy: boolean } })
					._afterwordRelationship
			: undefined;

	return json(
		buildRelationship(String((account as { id?: string })?.id || event.params.id), {
			following: actorId === localActorId ? false : true,
			followedBy: Boolean(meta?.followedBy)
		})
	);
}
