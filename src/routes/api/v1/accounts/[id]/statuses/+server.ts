import { json } from '@sveltejs/kit';
import { getActorId, getActivityPubOrigin } from '$lib/server/activitypub';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import {
	buildHomeTimeline,
	decodeMastodonAccountId,
	filterMastodonStatuses,
	fetchRemoteStatusesForActor,
	resolveAccountByIdOrAcct
} from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const origin = getActivityPubOrigin(event);
	const localActorId = getActorId(origin);
	const actorId = decodeMastodonAccountId(event.params.id) || event.params.id;
	const limit = Math.max(1, Math.min(Number.parseInt(event.url.searchParams.get('limit') || '20', 10) || 20, 40));
	const maxId = event.url.searchParams.get('max_id');
	const sinceId = event.url.searchParams.get('since_id');
	const minId = event.url.searchParams.get('min_id');
	const excludeReplies = event.url.searchParams.get('exclude_replies') === 'true';
	const excludeReblogs = event.url.searchParams.get('exclude_reblogs') === 'true';
	const onlyMedia = event.url.searchParams.get('only_media') === 'true';
	const pinnedParam = event.url.searchParams.get('pinned');
	const pinned = pinnedParam === null ? null : pinnedParam === 'true';

	if (actorId === localActorId) {
		const timeline = await buildHomeTimeline(event, limit);
		return json(
			filterMastodonStatuses(
				timeline.filter((item) => String(item.account?.uri || '') === localActorId),
				{ maxId, sinceId, minId, excludeReplies, excludeReblogs, onlyMedia, pinned, limit }
			),
			{
			headers: {
				'cache-control': 'no-store'
			}
		});
	}

	await resolveAccountByIdOrAcct(event, actorId);
	const remoteStatuses = (await fetchRemoteStatusesForActor(event, actorId, 60)).filter(Boolean) as Record<
		string,
		unknown
	>[];
	return json(
		filterMastodonStatuses(remoteStatuses, {
			maxId,
			sinceId,
			minId,
			excludeReplies,
			excludeReblogs,
			onlyMedia,
			pinned,
			limit
		}),
		{
		headers: {
			'cache-control': 'no-store'
		}
	});
}
