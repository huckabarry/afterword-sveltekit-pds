import { fail, redirect } from '@sveltejs/kit';
import { followRemoteActor, listFollowing, unfollowRemoteActor } from '$lib/server/activitypub-follows';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		following: await listFollowing(event),
		followed: event.url.searchParams.get('followed') === '1',
		unfollowed: event.url.searchParams.get('unfollowed') === '1'
	};
};

export const actions: Actions = {
	follow: async (event) => {
		const form = await event.request.formData();
		const actor = String(form.get('actor') || '').trim();

		if (!actor) {
			return fail(400, { error: 'Enter an ActivityPub actor URL to follow.' });
		}

		try {
			await followRemoteActor(event, actor);
		} catch (followError) {
			const message = followError instanceof Error ? followError.message : String(followError);
			return fail(400, { error: message || 'Unable to follow account right now.' });
		}

		throw redirect(303, '/admin/following/accounts?followed=1');
	},
	unfollow: async (event) => {
		const form = await event.request.formData();
		const actorId = String(form.get('actorId') || '').trim();

		if (!actorId) {
			return fail(400, { error: 'Missing account to unfollow.' });
		}

		await unfollowRemoteActor(event, actorId);
		throw redirect(303, '/admin/following/accounts?unfollowed=1');
	}
};
