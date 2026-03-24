import { error, fail } from '@sveltejs/kit';
import { fetchActivityJson, stripHtmlToText } from '$lib/server/activitypub-replies';
import { followRemoteActor, getFollowingByActorId, listFollowing, unfollowRemoteActor } from '$lib/server/activitypub-follows';
import {
	listCachedRemoteStatusesForActor,
	syncRemoteStatusesForActor,
	type CachedRemoteStatus
} from '$lib/server/mastodon-remote-statuses';
import type { Actions, PageServerLoad } from './$types';

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getImageUrl(value: unknown) {
	if (!value) return null;
	if (typeof value === 'string') return getString(value);
	if (typeof value === 'object') {
		return getString((value as Record<string, unknown>).url);
	}
	return null;
}

export const load: PageServerLoad = async (event) => {
	const actorId = String(event.url.searchParams.get('actor') || '').trim();
	if (!actorId) {
		throw error(400, 'Missing actor');
	}

	const followingRecord = await getFollowingByActorId(event, actorId);
	let actorDoc: Record<string, unknown> | null = null;
	try {
		actorDoc = await fetchActivityJson(actorId);
	} catch {
		actorDoc = null;
	}

	const statuses =
		(await syncRemoteStatusesForActor(event, actorId, {
			freshnessMs: 300_000,
			maxPages: 2,
			maxItems: 40
		}).catch(() => null)) ||
		(await listCachedRemoteStatusesForActor(event, actorId, { limit: 40 }));

	const followingActorIds = new Set((await listFollowing(event)).map((account) => account.actorId));

	const actorName =
		getString(actorDoc?.name) ||
		followingRecord?.displayName ||
		followingRecord?.handle ||
		actorId;
	const actorHandle =
		getString(actorDoc?.preferredUsername) ||
		followingRecord?.handle ||
		null;
	const actorSummary =
		getString(stripHtmlToText(String(actorDoc?.summary || ''))) ||
		followingRecord?.summary ||
		null;
	const actorProfileUrl =
		getString(actorDoc?.url) ||
		followingRecord?.profileUrl ||
		actorId;
	const actorAvatarUrl =
		getImageUrl(actorDoc?.icon) ||
		followingRecord?.avatarUrl ||
		null;
	const actorHeaderUrl =
		getImageUrl(actorDoc?.image) ||
		actorAvatarUrl;

	return {
		actorId,
		actor: {
			name: actorName,
			handle: actorHandle,
			summary: actorSummary,
			profileUrl: actorProfileUrl,
			avatarUrl: actorAvatarUrl,
			headerUrl: actorHeaderUrl,
			isFollowing: followingActorIds.has(actorId)
		},
		statuses: statuses.map((status: CachedRemoteStatus) => ({
			...status,
			actorName: status.actorName || actorName,
			actorHandle: status.actorHandle || actorHandle,
			actorSummary: status.actorSummary || actorSummary,
			actorUrl: status.actorUrl || actorProfileUrl,
			actorAvatarUrl: status.actorAvatarUrl || actorAvatarUrl
		})),
		followed: event.url.searchParams.get('followed') === '1',
		unfollowed: event.url.searchParams.get('unfollowed') === '1',
		refreshed: event.url.searchParams.get('refreshed') === '1'
	};
};

export const actions: Actions = {
	follow: async (event) => {
		const form = await event.request.formData();
		const actorId = String(form.get('actorId') || '').trim();

		if (!actorId) {
			return fail(400, { error: 'Missing account to follow.' });
		}

		await followRemoteActor(event, actorId);
		return { followed: true, actorId };
	},
	unfollow: async (event) => {
		const form = await event.request.formData();
		const actorId = String(form.get('actorId') || '').trim();

		if (!actorId) {
			return fail(400, { error: 'Missing account to unfollow.' });
		}

		await unfollowRemoteActor(event, actorId);
		return { unfollowed: true, actorId };
	},
	refresh: async (event) => {
		const form = await event.request.formData();
		const actorId = String(form.get('actorId') || '').trim();

		if (!actorId) {
			return fail(400, { error: 'Missing actor to refresh.' });
		}

		await syncRemoteStatusesForActor(event, actorId, {
			force: true,
			freshnessMs: 0,
			maxPages: 2,
			maxItems: 40
		});

		return { refreshed: true, actorId };
	}
};
