import { error, fail, redirect } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { createLocalNote, createLocalReply, updateLocalReplyDeliveryStatus } from '$lib/server/ap-notes';
import {
	deliverReplyToRemoteActor,
	localReplyToCreateActivity,
	resolveThreadRootObjectId,
	textToParagraphHtml
} from '$lib/server/activitypub-replies';
import { listFollowers } from '$lib/server/followers';
import type { Actions, PageServerLoad } from './$types';

async function deliverLocalNoteToFollowers(
	event: Parameters<Actions['default']>[0],
	note: NonNullable<Awaited<ReturnType<typeof createLocalNote>>>
) {
	const origin = getActivityPubOrigin(event);
	const followers = await listFollowers(event);
	const activity = localReplyToCreateActivity(note, origin);

	for (const follower of followers) {
		const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl;
		if (!inboxUrl) continue;
		await sendSignedActivity(origin, inboxUrl, activity);
	}
}

export const load: PageServerLoad = async ({ url }) => {
	return {
		replyTo: url.searchParams.get('replyTo') || ''
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const replyTo = String(form.get('replyTo') || '').trim();
		const content = String(form.get('content') || '').trim();

		if (!content) {
			return fail(400, {
				error: 'Write something before publishing.',
				replyTo,
				content
			});
		}

		const contentHtml = textToParagraphHtml(content);
		const origin = getActivityPubOrigin(event);

		if (replyTo) {
			const threadRootObjectId = await resolveThreadRootObjectId(replyTo, origin);
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
		}

		const note = await createLocalNote(event, {
			contentHtml,
			contentText: content
		});

		if (!note) {
			throw error(500, 'Unable to create note');
		}

		await deliverLocalNoteToFollowers(event, note);
		await updateLocalReplyDeliveryStatus(event, note.localSlug || '', 'delivered');
		throw redirect(303, '/admin?posted=1');
	}
};
