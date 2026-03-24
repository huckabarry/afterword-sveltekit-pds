import { json } from '@sveltejs/kit';
import { getActorId, getActivityPubOrigin } from '$lib/server/activitypub';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { muteActor } from '$lib/server/mastodon-state';
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
		await muteActor(event, actorId, {
			notifications: event.url.searchParams.get('notifications') === 'true'
		});
	}

	const account = await resolveAccountByIdOrAcct(event, actorId);
	const meta =
		account && typeof account === 'object' && '_afterwordRelationship' in account
			? (account as { _afterwordRelationship?: { following: boolean; followedBy: boolean } })
					._afterwordRelationship
			: undefined;

	return json(
		buildRelationship(String((account as { id?: string })?.id || event.params.id), {
			following: Boolean(meta?.following),
			followedBy: Boolean(meta?.followedBy),
			muting: actorId !== localActorId
		})
	);
}
