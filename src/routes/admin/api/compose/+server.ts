import { json } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { createLocalNote, createLocalReply, updateLocalReplyDeliveryStatus } from '$lib/server/ap-notes';
import { requireAdminAccess } from '$lib/server/admin';
import { listFollowers } from '$lib/server/followers';
import {
	deliverReplyToRemoteActor,
	localReplyToCreateActivity,
	localReplyToRemoteCreateActivity,
	normalizeMentionText,
	resolveThreadRootObjectId,
	textToParagraphHtml
} from '$lib/server/activitypub-replies';

function isLocalReplyTarget(origin: string, objectId: string) {
	return String(objectId || '').startsWith(`${origin}/ap/`);
}

async function deliverLocalNoteToFollowers(
	event: Parameters<typeof createLocalNote>[0],
	note: NonNullable<Awaited<ReturnType<typeof createLocalNote>>>
) {
	const origin = getActivityPubOrigin(event);
	const followers = await listFollowers(event);
	const activity = await localReplyToCreateActivity(note, origin);

	for (const follower of followers) {
		const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl;
		if (!inboxUrl) continue;
		await sendSignedActivity(origin, inboxUrl, activity);
	}
}

export async function POST(event) {
	await requireAdminAccess(event);

	const body = await event.request.json().catch(() => null);
	const replyTo = String(body?.replyTo || '').trim();
	const content = normalizeMentionText(String(body?.content || '').trim());
	const attachmentInput: unknown[] = Array.isArray(body?.attachments) ? body.attachments : [];
	const attachments = attachmentInput
		.map((item: unknown) => {
					if (!item || typeof item !== 'object') return null;
					const url = String((item as { url?: unknown }).url || '').trim();
					if (!url) return null;
					return {
						url,
						mediaType: String((item as { mediaType?: unknown }).mediaType || 'image/jpeg'),
						alt: String((item as { alt?: unknown }).alt || '')
					};
				})
		.filter(
			(item): item is { url: string; mediaType: string; alt: string } => Boolean(item)
		);

	if (!content) {
		return json({ error: 'Content is required.' }, { status: 400 });
	}

	const origin = getActivityPubOrigin(event);
	const contentHtml = textToParagraphHtml(content);

	if (replyTo) {
		const threadRootObjectId = await resolveThreadRootObjectId(replyTo, origin);
		const reply = await createLocalReply(event, {
			inReplyToObjectId: replyTo,
			threadRootObjectId,
			contentHtml,
			contentText: content,
			attachments
		});

		if (!reply) {
			return json({ error: 'Unable to create reply.' }, { status: 500 });
		}

		try {
			if (isLocalReplyTarget(origin, replyTo)) {
				await deliverLocalNoteToFollowers(event, reply);
			} else {
				const remoteActivity = await localReplyToRemoteCreateActivity(reply, origin, replyTo);
				await deliverReplyToRemoteActor(origin, replyTo, remoteActivity);
			}
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', 'delivered');
		} catch (deliveryError) {
			const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', `failed:${message}`);
			return json({ error: message || 'Unable to deliver reply.' }, { status: 500 });
		}

		return json({
			ok: true,
			post: {
				noteId: reply.noteId,
				localSlug: reply.localSlug,
				contentText: reply.contentText,
				publishedAt: reply.publishedAt,
				replyTo
			}
		});
	}

	const note = await createLocalNote(event, {
		contentHtml,
		contentText: content,
		attachments
	});

	if (!note) {
		return json({ error: 'Unable to create note.' }, { status: 500 });
	}

	try {
		await deliverLocalNoteToFollowers(event, note);
		await updateLocalReplyDeliveryStatus(event, note.localSlug || '', 'delivered');
	} catch (deliveryError) {
		const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
		await updateLocalReplyDeliveryStatus(event, note.localSlug || '', `failed:${message}`);
		return json({ error: message || 'Unable to deliver note.' }, { status: 500 });
	}

	return json({
		ok: true,
		post: {
			noteId: note.noteId,
			localSlug: note.localSlug,
			contentText: note.contentText,
			publishedAt: note.publishedAt
		}
	});
}
