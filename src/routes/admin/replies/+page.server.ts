import { error, fail, redirect } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { createLocalReply, listRecentRemoteReplies, updateLocalReplyDeliveryStatus } from '$lib/server/ap-notes';
import { deliverLikeToRemoteObject } from '$lib/server/activitypub-likes';
import {
	deliverReplyToRemoteActor,
	localReplyToCreateActivity,
	resolveThreadRootObjectId,
	textToParagraphHtml
} from '$lib/server/activitypub-replies';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		replies: await listRecentRemoteReplies(event, 50),
		sent: event.url.searchParams.get('sent') === '1',
		liked: event.url.searchParams.get('liked') === '1'
	};
};

export const actions: Actions = {
	reply: async (event) => {
		const form = await event.request.formData();
		const replyTo = String(form.get('replyTo') || '').trim();
		const content = String(form.get('content') || '').trim();

		if (!replyTo || !content) {
			return fail(400, { error: 'Reply target and content are required.' });
		}

		const origin = getActivityPubOrigin(event);
		const threadRootObjectId = await resolveThreadRootObjectId(replyTo, origin);
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
			const activity = localReplyToCreateActivity(reply, origin);
			await deliverReplyToRemoteActor(origin, replyTo, activity);
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', 'delivered');
		} catch (deliveryError) {
			const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', `failed:${message}`);
			throw deliveryError;
		}

		throw redirect(303, '/admin/replies?sent=1');
	},
	like: async (event) => {
		const form = await event.request.formData();
		const objectId = String(form.get('objectId') || '').trim();

		if (!objectId) {
			return fail(400, { error: 'Missing object to like.' });
		}

		await deliverLikeToRemoteObject(getActivityPubOrigin(event), objectId);
		throw redirect(303, '/admin/replies?liked=1');
	}
};
