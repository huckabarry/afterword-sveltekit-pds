import { error, fail } from '@sveltejs/kit';
import { getActivityPubHandle, getActivityPubOrigin, getActorId } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { resolveReplyContext } from '$lib/server/admin-reply-context';
import {
	createLocalReply,
	listLocalNotes,
	type LocalApNoteListItem,
	updateLocalReplyDeliveryStatus
} from '$lib/server/ap-notes';
import { deliverLikeToRemoteObject } from '$lib/server/activitypub-likes';
import { fetchActivityJson, fetchRemoteActor, localReplyToRemoteCreateActivity, normalizeMentionText, resolveThreadRootObjectId, textToParagraphHtml } from '$lib/server/activitypub-replies';
import { listFollowingActorIds } from '$lib/server/activitypub-follows';
import { getStatusesLite, type StatusPost } from '$lib/server/atproto';
import { getSiteProfile } from '$lib/server/profile';
import { favouriteObject, findFavouritedObjectIds, findRebloggedObjectIds, reblogObject } from '$lib/server/mastodon-state';
import { listCachedRemoteStatusesForActors, syncRemoteStatusesForActor, type CachedRemoteStatus } from '$lib/server/mastodon-remote-statuses';
import type { Actions, PageServerLoad } from './$types';

type AdminFollowingFeedStatus = {
	objectId: string;
	actorId: string;
	actorName: string | null;
	actorHandle: string | null;
	actorSummary: string | null;
	actorUrl: string | null;
	actorAvatarUrl: string | null;
	contentHtml: string;
	contentText: string;
	publishedAt: string;
	objectUrl: string | null;
	inReplyToObjectId: string | null;
	attachments: Array<{
		url: string;
		mediaType: string;
		alt: string;
	}>;
	favourited: boolean;
	reblogged: boolean;
	replyContext: Awaited<ReturnType<typeof resolveReplyContext>>;
	source: 'remote' | 'local' | 'mirrored';
	visibility: 'public' | 'followers' | 'direct';
	openHref: string;
	sourceHref: string | null;
};

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
	const origin = getActivityPubOrigin(event);
	const followingActorIds = await listFollowingActorIds(event);
	const statuses = followingActorIds.length
		? await listCachedRemoteStatusesForActors(
				event,
				followingActorIds,
				{ limit: 90 }
			)
		: [];
	const [profile, localNotes, mirroredStatuses, favouritedObjectIds, rebloggedObjectIds, replyContexts] =
		await Promise.all([
			getSiteProfile(event),
			listLocalNotes(event, 60),
			getStatusesLite(),
			findFavouritedObjectIds(
				event,
				statuses.map((status: CachedRemoteStatus) => status.objectId)
			),
			findRebloggedObjectIds(
				event,
				statuses.map((status: CachedRemoteStatus) => status.objectId)
			),
			Promise.all(
				statuses.map(async (status: CachedRemoteStatus) => [
					status.objectId,
					status.inReplyToObjectId
						? await resolveReplyContext(event, origin, status.inReplyToObjectId, {
								allowRemoteFetch: false
							})
						: null
				] as const)
			)
		]);
	const replyContextByObjectId = new Map(replyContexts);
	const localActorId = getActorId(origin);
	const localActorHandle = getActivityPubHandle(origin);
	const localActorAvatarUrl = String(profile.avatarUrl || '').startsWith('http')
		? String(profile.avatarUrl || '')
		: `${origin}${profile.avatarUrl || '/assets/images/status-avatar.jpg'}`;

	const remoteStatuses: AdminFollowingFeedStatus[] = statuses.map((status: CachedRemoteStatus) => ({
		...status,
		favourited: favouritedObjectIds.has(status.objectId),
		reblogged: rebloggedObjectIds.has(status.objectId),
		replyContext: replyContextByObjectId.get(status.objectId) || null,
		source: 'remote',
		visibility: 'public',
		openHref: status.objectUrl || status.objectId,
		sourceHref: null
	}));

	const ownLocalStatuses: AdminFollowingFeedStatus[] = localNotes
		.filter((note: LocalApNoteListItem) => !note.inReplyToObjectId && note.visibility !== 'direct')
		.map((note: LocalApNoteListItem) => ({
			objectId: note.noteId,
			actorId: localActorId,
			actorName: profile.displayName,
			actorHandle: localActorHandle,
			actorSummary: profile.bio,
			actorUrl: `${origin}/about`,
			actorAvatarUrl: localActorAvatarUrl,
			contentHtml: note.contentHtml,
			contentText: note.contentText,
			publishedAt: note.publishedAt,
			objectUrl: note.objectUrl || note.noteId,
			inReplyToObjectId: null,
			attachments: note.attachments,
			favourited: false,
			reblogged: false,
			replyContext: null,
			source: 'local',
			visibility: note.visibility,
			openHref: note.localSlug ? `/admin/posts/${note.localSlug}` : '/admin/posts',
			sourceHref: null
		}));

	const ownMirroredStatuses: AdminFollowingFeedStatus[] = mirroredStatuses
		.filter((status: StatusPost) => !status.isReply)
		.slice(0, 60)
		.map((status: StatusPost) => ({
			objectId: `${origin}/ap/status/${status.slug}`,
			actorId: localActorId,
			actorName: status.displayName,
			actorHandle: status.handle,
			actorSummary: null,
			actorUrl: status.blueskyUrl,
			actorAvatarUrl: status.avatar || localActorAvatarUrl,
			contentHtml: status.html,
			contentText: status.text,
			publishedAt: status.date.toISOString(),
			objectUrl: `${origin}/status/${status.slug}`,
			inReplyToObjectId: null,
			attachments: status.images.map((image: StatusPost['images'][number]) => ({
				url: image.fullsize || image.thumb,
				mediaType: 'image/jpeg',
				alt: image.alt || ''
			})),
			favourited: false,
			reblogged: false,
			replyContext: null,
			source: 'mirrored',
			visibility: 'public',
			openHref: `/status/${status.slug}`,
			sourceHref: status.blueskyUrl
		}));

	const statusesWithState = [...remoteStatuses, ...ownLocalStatuses, ...ownMirroredStatuses]
		.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
		.slice(0, 120);

	return {
		statuses: statusesWithState,
		followed: event.url.searchParams.get('followed') === '1',
		unfollowed: event.url.searchParams.get('unfollowed') === '1',
		liked: event.url.searchParams.get('liked') === '1',
		boosted: event.url.searchParams.get('boosted') === '1',
		replied: event.url.searchParams.get('replied') === '1',
		refreshed: event.url.searchParams.get('refreshed') === '1'
	};
};

export const actions: Actions = {
	like: async (event) => {
		const form = await event.request.formData();
		const objectId = String(form.get('objectId') || '').trim();

		if (!objectId) {
			return fail(400, { error: 'Missing post to like.' });
		}

		const delivery = await deliverLikeToRemoteObject(getActivityPubOrigin(event), objectId);
		await favouriteObject(event, { objectId, activityId: delivery.activityId });
		return { liked: true, objectId };
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
		return { boosted: true, objectId };
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

		return { replied: true, replyTo };
	},
	refresh: async (event) => {
		const followingActorIds = await listFollowingActorIds(event);

		for (const actorId of followingActorIds) {
			await syncRemoteStatusesForActor(event, actorId, {
				force: true,
				freshnessMs: 0,
				maxPages: 2,
				maxItems: 60
			}).catch(() => []);
		}

		return { refreshed: true };
	}
};
