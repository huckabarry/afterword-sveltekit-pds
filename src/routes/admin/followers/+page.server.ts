import { fail } from '@sveltejs/kit';
import { followRemoteActor, listFollowing, unfollowRemoteActor } from '$lib/server/activitypub-follows';
import { listFollowers } from '$lib/server/followers';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const [followers, following] = await Promise.all([listFollowers(event), listFollowing(event)]);
	const followingActorIds = new Set(following.map((account) => account.actorId));

	return {
		followers: followers.map((follower) => ({
			...follower,
			isFollowing: followingActorIds.has(follower.actorId)
		})),
		followed: event.url.searchParams.get('followed') === '1',
		unfollowed: event.url.searchParams.get('unfollowed') === '1'
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
	}
};
