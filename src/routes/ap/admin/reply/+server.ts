import { error } from '@sveltejs/kit';
import { requireDeliveryToken } from '$lib/server/activitypub-admin';
import { createLocalReply, updateLocalReplyDeliveryStatus } from '$lib/server/ap-notes';
import {
	deliverReplyToRemoteActor,
	localReplyToCreateActivity,
	localReplyToRemoteCreateActivity,
	normalizeMentionText,
	resolveThreadRootObjectId,
	textToParagraphHtml
} from '$lib/server/activitypub-replies';
import { getActivityPubOrigin } from '$lib/server/activitypub';

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function POST(event) {
	requireDeliveryToken(event.request);

	const payload = (await event.request.json()) as {
		inReplyTo?: unknown;
		content?: unknown;
	};

	const inReplyTo = getString(payload.inReplyTo);
	const content = normalizeMentionText(getString(payload.content) || '');

	if (!inReplyTo) {
		throw error(400, '`inReplyTo` is required');
	}

	if (!content) {
		throw error(400, '`content` is required');
	}

	const origin = getActivityPubOrigin(event);
	const threadRootObjectId = await resolveThreadRootObjectId(inReplyTo, origin);
	const contentHtml = textToParagraphHtml(content);
	const reply = await createLocalReply(event, {
		inReplyToObjectId: inReplyTo,
		threadRootObjectId,
		contentHtml,
		contentText: content
	});

	if (!reply) {
		throw error(500, 'Unable to create local reply');
	}

	try {
		const activity = inReplyTo.startsWith(`${origin}/ap/`)
			? await localReplyToCreateActivity(reply, origin)
			: await localReplyToRemoteCreateActivity(reply, origin, inReplyTo);
		const delivery = await deliverReplyToRemoteActor(origin, inReplyTo, activity);
		await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', 'delivered');

		return new Response(
			JSON.stringify(
				{
					ok: true,
					replyId: reply.noteId,
					threadRootObjectId,
					targetActorId: delivery.targetActorId,
					targetInbox: delivery.targetInbox
				},
				null,
				2
			),
			{
				headers: {
					'content-type': 'application/json; charset=utf-8'
				}
			}
		);
	} catch (deliveryError) {
		const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
		await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', `failed:${message}`);
		throw deliveryError;
	}
}
