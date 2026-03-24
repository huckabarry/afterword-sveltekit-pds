import { error, fail, redirect } from '@sveltejs/kit';
import { getActivityPubOrigin, getActorId } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { createLocalReply, updateLocalReplyDeliveryStatus } from '$lib/server/ap-notes';
import { deliverLikeToRemoteObject } from '$lib/server/activitypub-likes';
import { fetchActivityJson, fetchRemoteActor, localReplyToRemoteCreateActivity, normalizeMentionText, resolveThreadRootObjectId, textToParagraphHtml } from '$lib/server/activitypub-replies';
import { followRemoteActor, listFollowing, unfollowRemoteActor } from '$lib/server/activitypub-follows';
import { isObjectFavourited, isObjectReblogged, reblogObject } from '$lib/server/mastodon-state';
import { listCachedRemoteStatusesForActors, syncRemoteStatusesForActor, type CachedRemoteStatus } from '$lib/server/mastodon-remote-statuses';
import type { Actions, PageServerLoad } from './$types';

async function sendBoost(origin: string, objectId: string) {
	const targetObject = await fetchActivityJson(objectId);
	const targetActorId =
		(typeof targetObject.attributedTo === 'string' && targetObject.attributedTo) ||
		(typeof targetObject.actor === 'string' && targetObject.actor) ||
		'';

	if (!targetActorId) {
		throw new Error('Target object does not declare an actor');
	}

	const remoteActor = await fetchRemoteActor(targetActorId);
	const inboxUrl = remoteActor.sharedInboxUrl || remoteActor.inboxUrl;
	if (!inboxUrl) {
		throw new Error('Target actor does not expose an inbox');
	}

	const activityId = `${getActorId(origin)}/announces/${crypto.randomUUID()}`;
	await sendSignedActivity(origin, inboxUrl, {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: activityId,
		type: 'Announce',
		actor: getActorId(origin),
		object: objectId
	});

	return activityId;
}

export const load: PageServerLoad = async (event) => {
	const following = await listFollowing(event);

	await Promise.all(
		following.map((account) =>
			syncRemoteStatusesForActor(event, account.actorId, {
				freshnessMs: 60_000,
				maxPages: 3,
				maxItems: 80
			}).catch(() => [])
		)
	);

	const statuses = following.length
		? await listCachedRemoteStatusesForActors(
				event,
				following.map((account) => account.actorId),
				{ limit: 120 }
			)
		: [];

	const statusesWithState = await Promise.all(
		statuses.map(async (status: CachedRemoteStatus) => ({
			...status,
			favourited: await isObjectFavourited(event, status.objectId),
			reblogged: await isObjectReblogged(event, status.objectId)
		}))
	);

	return {
		following,
		statuses: statusesWithState,
		followed: event.url.searchParams.get('followed') === '1',
		unfollowed: event.url.searchParams.get('unfollowed') === '1',
		liked: event.url.searchParams.get('liked') === '1',
		boosted: event.url.searchParams.get('boosted') === '1',
		replied: event.url.searchParams.get('replied') === '1'
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

		throw redirect(303, '/admin/following?followed=1');
	},
	unfollow: async (event) => {
		const form = await event.request.formData();
		const actorId = String(form.get('actorId') || '').trim();

		if (!actorId) {
			return fail(400, { error: 'Missing account to unfollow.' });
		}

		await unfollowRemoteActor(event, actorId);
		throw redirect(303, '/admin/following?unfollowed=1');
	},
	like: async (event) => {
		const form = await event.request.formData();
		const objectId = String(form.get('objectId') || '').trim();

		if (!objectId) {
			return fail(400, { error: 'Missing post to like.' });
		}

		await deliverLikeToRemoteObject(getActivityPubOrigin(event), objectId);
		throw redirect(303, '/admin/following?liked=1');
	},
	boost: async (event) => {
		const form = await event.request.formData();
		const objectId = String(form.get('objectId') || '').trim();

		if (!objectId) {
			return fail(400, { error: 'Missing post to boost.' });
		}

		const origin = getActivityPubOrigin(event);
		const activityId = await sendBoost(origin, objectId);
		await reblogObject(event, { objectId, activityId });
		throw redirect(303, '/admin/following?boosted=1');
	},
	reply: async (event) => {
		const form = await event.request.formData();
		const replyTo = String(form.get('replyTo') || '').trim();
		const content = normalizeMentionText(String(form.get('content') || '').trim());

		if (!replyTo || !content) {
			return fail(400, { error: 'Reply target and content are required.' });
		}

		const origin = getActivityPubOrigin(event);
		const threadRootObjectId = await resolveThreadRootObjectId(replyTo, origin, event);
		const reply = await createLocalReply(event, {
			inReplyToObjectId: replyTo,
			threadRootObjectId,
			contentHtml: textToParagraphHtml(content),
			contentText: content
		});

		if (!reply) {
			throw error(500, 'Unable to create reply');
		}

		try {
			const remoteActivity = await localReplyToRemoteCreateActivity(reply, origin, replyTo);
			const targetObject = await fetchActivityJson(replyTo);
			const targetActorId =
				(typeof targetObject.attributedTo === 'string' && targetObject.attributedTo) ||
				(typeof targetObject.actor === 'string' && targetObject.actor) ||
				'';
			if (!targetActorId) {
				throw new Error('Target object does not declare an actor');
			}
			const remoteActor = await fetchRemoteActor(targetActorId);
			const inboxUrl = remoteActor.sharedInboxUrl || remoteActor.inboxUrl;
			if (!inboxUrl) {
				throw new Error('Target actor does not expose an inbox');
			}
			await sendSignedActivity(origin, inboxUrl, remoteActivity);
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', 'delivered');
		} catch (replyError) {
			const message = replyError instanceof Error ? replyError.message : String(replyError);
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', `failed:${message}`);
			return fail(500, { error: message || 'Unable to send reply right now.' });
		}

		throw redirect(303, '/admin/following?replied=1');
	}
};
