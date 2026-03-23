import { json } from '@sveltejs/kit';
import { getActorId, getActivityPubOrigin } from '$lib/server/activitypub';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import {
	buildRelationship,
	decodeMastodonAccountId,
	resolveAccountByIdOrAcct
} from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const origin = getActivityPubOrigin(event);
	const localActorId = getActorId(origin);
	const rawIds = event.url.searchParams.getAll('id[]').concat(event.url.searchParams.getAll('id'));

	const relationships = await Promise.all(
		rawIds.map(async (rawId) => {
			const decoded = decodeMastodonAccountId(rawId) || rawId;
			if (decoded === localActorId) {
				return buildRelationship(rawId, { following: false, followedBy: false });
			}

			const account = await resolveAccountByIdOrAcct(event, decoded);
			const meta =
				account && typeof account === 'object' && '_afterwordRelationship' in account
					? (account as { _afterwordRelationship?: { following: boolean; followedBy: boolean } })
							._afterwordRelationship
					: undefined;

			return buildRelationship(String((account as { id?: string })?.id || rawId), {
				following: Boolean(meta?.following),
				followedBy: Boolean(meta?.followedBy)
			});
		})
	);

	return json(relationships);
}
