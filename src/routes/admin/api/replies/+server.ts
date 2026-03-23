import { json } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { deliverLikeToRemoteObject } from '$lib/server/activitypub-likes';
import {
	createLocalReply,
	listRecentInboxReplies,
	updateLocalReplyDeliveryStatus
} from '$lib/server/ap-notes';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { requireAdminAccess } from '$lib/server/admin';
import { listFollowers } from '$lib/server/followers';
import { enrichReplies } from '$lib/server/activitypub-reply-previews';
import {
	deliverReplyToRemoteActor,
	localReplyToCreateActivity,
	resolveThreadRootObjectId,
	textToParagraphHtml
} from '$lib/server/activitypub-replies';

function isLocalReplyTarget(origin: string, objectId: string) {
	return String(objectId || '').startsWith(`${origin}/ap/`);
}

async function deliverLocalReplyToFollowers(
	event: Parameters<typeof createLocalReply>[0],
	reply: NonNullable<Awaited<ReturnType<typeof createLocalReply>>>
) {
	const origin = getActivityPubOrigin(event);
	const followers = await listFollowers(event);
	const activity = localReplyToCreateActivity(reply, origin);

	for (const follower of followers) {
		const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl;
		if (!inboxUrl) continue;
		await sendSignedActivity(origin, inboxUrl, activity);
	}
}

export async function GET(event) {
	await requireAdminAccess(event);

	const origin = getActivityPubOrigin(event);
	const replies = await listRecentInboxReplies(event, origin, 100);
	const enrichedReplies = await enrichReplies(event, replies);

	return json({
		replies: enrichedReplies.map((reply) => ({
			noteId: reply.noteId,
			actorId: reply.actorId,
			actorName: reply.actorName,
			actorHandle: reply.actorHandle,
			avatarUrl: reply.avatarUrl,
			profileUrl: reply.profileUrl,
			contentHtml: reply.contentHtml,
			contentText: reply.contentText,
			publishedAt: reply.publishedAt,
			inReplyToObjectId: reply.inReplyToObjectId,
			threadRootObjectId: reply.threadRootObjectId,
			objectUrl: reply.objectUrl,
			attachments: reply.attachments
		}))
	});
}

export async function POST(event) {
	await requireAdminAccess(event);

	const body = await event.request.json().catch(() => null);
	const intent = String(body?.intent || 'reply').trim();

	if (intent === 'like') {
		const objectId = String(body?.objectId || '').trim();
		if (!objectId) {
			return json({ error: 'Missing objectId' }, { status: 400 });
		}

		await deliverLikeToRemoteObject(getActivityPubOrigin(event), objectId);
		return json({ ok: true });
	}

	const replyTo = String(body?.replyTo || '').trim();
	const content = String(body?.content || '').trim();

	if (!replyTo || !content) {
		return json({ error: 'Reply target and content are required.' }, { status: 400 });
	}

	const origin = getActivityPubOrigin(event);
	const threadRootObjectId = await resolveThreadRootObjectId(replyTo, origin);
	const reply = await createLocalReply(event, {
		inReplyToObjectId: replyTo,
		threadRootObjectId,
		contentHtml: textToParagraphHtml(content),
		contentText: content
	});

	if (!reply) {
		return json({ error: 'Unable to create reply.' }, { status: 500 });
	}

	try {
		const activity = localReplyToCreateActivity(reply, origin);
		if (isLocalReplyTarget(origin, replyTo)) {
			await deliverLocalReplyToFollowers(event, reply);
		} else {
			await deliverReplyToRemoteActor(origin, replyTo, activity);
		}
		await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', 'delivered');
	} catch (deliveryError) {
		const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
		await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', `failed:${message}`);
		return json({ error: message || 'Unable to deliver reply.' }, { status: 500 });
	}

	return json({
		ok: true,
		reply: {
			noteId: reply.noteId,
			localSlug: reply.localSlug,
			contentText: reply.contentText,
			publishedAt: reply.publishedAt
		}
	});
}
