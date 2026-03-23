import { json } from '@sveltejs/kit';
import { getActorId, getActivityPubOrigin } from '$lib/server/activitypub';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import {
	buildHomeTimeline,
	decodeMastodonAccountId,
	resolveAccountByIdOrAcct
} from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const origin = getActivityPubOrigin(event);
	const localActorId = getActorId(origin);
	const actorId = decodeMastodonAccountId(event.params.id) || event.params.id;
	const limit = Math.max(1, Math.min(Number.parseInt(event.url.searchParams.get('limit') || '20', 10) || 20, 40));

	if (actorId === localActorId) {
		const timeline = await buildHomeTimeline(event, limit);
		return json(timeline.filter((item) => String(item.account?.uri || '') === localActorId).slice(0, limit));
	}

	await resolveAccountByIdOrAcct(event, actorId);
	return json([]);
}
