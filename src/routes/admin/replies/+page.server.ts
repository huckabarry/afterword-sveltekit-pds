import { error, fail } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import {
	createLocalReply,
	getLocalReplyBySlug,
	listRecentInboxReplies,
	updateLocalReplyDeliveryStatus
} from '$lib/server/ap-notes';
import { deliverLikeToRemoteObject } from '$lib/server/activitypub-likes';
import { enrichReplies } from '$lib/server/activitypub-reply-previews';
import { listFollowers } from '$lib/server/followers';
import { getSiteProfile } from '$lib/server/profile';
import { resolveReplyContext } from '$lib/server/admin-reply-context';
import { followRemoteActor, listFollowing, unfollowRemoteActor } from '$lib/server/activitypub-follows';
import {
	deliverReplyToRemoteActor,
	localReplyToCreateActivity,
	localReplyToRemoteCreateActivity,
	normalizeMentionText,
	resolveThreadRootObjectId,
	textToParagraphHtml
} from '$lib/server/activitypub-replies';
import type { Actions, PageServerLoad } from './$types';

async function deliverLocalReplyToFollowers(
	event: Parameters<Actions['reply']>[0],
	reply: NonNullable<Awaited<ReturnType<typeof createLocalReply>>>
) {
	const origin = getActivityPubOrigin(event);
	const followers = await listFollowers(event);
	const activity = await localReplyToCreateActivity(reply, origin);

	for (const follower of followers) {
		const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl;
		if (!inboxUrl) continue;
		await sendSignedActivity(origin, inboxUrl, activity);
	}
}

function isLocalReplyTarget(origin: string, objectId: string) {
	return String(objectId || '').startsWith(`${origin}/ap/`);
}

export const load: PageServerLoad = async (event) => {
	const origin = getActivityPubOrigin(event);
	const profile = await getSiteProfile(event);
	const [replies, following] = await Promise.all([
		listRecentInboxReplies(event, origin, 50),
		listFollowing(event)
	]);
	const followingActorIds = new Set(following.map((account) => account.actorId));
	const enrichedReplies = await enrichReplies(event, replies);
	const repliesWithContext = await Promise.all(
		enrichedReplies.map(async (reply) => {
			const effectiveThreadRootId = reply.inReplyToObjectId
				? await resolveThreadRootObjectId(reply.inReplyToObjectId, origin, event)
				: reply.threadRootObjectId;

			return {
				...reply,
				replyContext: reply.inReplyToObjectId ? await resolveReplyContext(event, origin, reply.inReplyToObjectId) : null,
				threadRootContext:
					effectiveThreadRootId && effectiveThreadRootId !== reply.inReplyToObjectId
						? await resolveReplyContext(event, origin, effectiveThreadRootId)
						: null,
				actorAvatarUrl:
					reply.origin === 'local'
						? profile.avatarUrl.startsWith('http')
							? profile.avatarUrl
							: `${origin}${profile.avatarUrl}`
						: reply.avatarUrl,
				actorProfileUrl: reply.origin === 'local' ? `${origin}/` : reply.profileUrl,
				isFollowing: reply.origin !== 'local' && followingActorIds.has(reply.actorId)
			};
		})
	);

	return {
		replies: repliesWithContext,
		sent: event.url.searchParams.get('sent') === '1',
		liked: event.url.searchParams.get('liked') === '1',
		followed: event.url.searchParams.get('followed') === '1',
		unfollowed: event.url.searchParams.get('unfollowed') === '1'
	};
};

export const actions: Actions = {
	reply: async (event) => {
		const form = await event.request.formData();
		const replyTo = String(form.get('replyTo') || '').trim();
		const content = normalizeMentionText(String(form.get('content') || '').trim());

		if (!replyTo || !content) {
			return fail(400, { error: 'Reply target and content are required.' });
		}

		const origin = getActivityPubOrigin(event);
		const threadRootObjectId = await resolveThreadRootObjectId(replyTo, origin, event);
		const contentHtml = textToParagraphHtml(content);
		const reply = await createLocalReply(event, {
			inReplyToObjectId: replyTo,
			threadRootObjectId,
			contentHtml,
			contentText: content
		});

		if (!reply) {
			throw error(500, 'Unable to create reply');
		}

		try {
			if (isLocalReplyTarget(origin, replyTo)) {
				await deliverLocalReplyToFollowers(event, reply);
			} else {
				const remoteActivity = await localReplyToRemoteCreateActivity(reply, origin, replyTo);
				await deliverReplyToRemoteActor(origin, replyTo, remoteActivity);
			}
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', 'delivered');
		} catch (deliveryError) {
			const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', `failed:${message}`);
			throw deliveryError;
		}

		return { sent: true, replyTo };
	},
	like: async (event) => {
		const form = await event.request.formData();
		const objectId = String(form.get('objectId') || '').trim();

		if (!objectId) {
			return fail(400, { error: 'Missing object to like.' });
		}

		await deliverLikeToRemoteObject(getActivityPubOrigin(event), objectId);
		return { liked: true, objectId };
	},
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
