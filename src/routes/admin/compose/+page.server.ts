import { error, fail, redirect } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { createLocalNote, createLocalReply, updateLocalReplyDeliveryStatus } from '$lib/server/ap-notes';
import { uploadImageFiles } from '$lib/server/media';
import {
	deliverReplyToRemoteActor,
	localReplyToCreateActivity,
	localReplyToRemoteCreateActivity,
	normalizeMentionText,
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
	const activity = await localReplyToCreateActivity(note, origin);

	for (const follower of followers) {
		const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl;
		if (!inboxUrl) continue;
		await sendSignedActivity(origin, inboxUrl, activity);
	}
}

function isLocalReplyTarget(origin: string, objectId: string) {
	return String(objectId || '').startsWith(`${origin}/ap/`);
}

export const load: PageServerLoad = async ({ url }) => {
	const replyTo = url.searchParams.get('replyTo') || '';

	if (!replyTo) {
		throw redirect(303, '/admin');
	}

	return { replyTo };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const replyTo = String(form.get('replyTo') || '').trim();
		const content = normalizeMentionText(String(form.get('content') || '').trim());
		const imageFiles = form
			.getAll('images')
			.filter((value): value is File => value instanceof File && value.size > 0);

		if (!content) {
			return fail(400, {
				error: 'Write something before publishing.',
				replyTo,
				content
			});
		}

		const contentHtml = textToParagraphHtml(content);
		const origin = getActivityPubOrigin(event);
		const attachments = await uploadImageFiles(event, imageFiles, {
			scope: 'ap-notes',
			prefix: replyTo ? 'reply' : 'note'
		});

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
				throw error(500, 'Unable to create reply');
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
				throw deliveryError;
			}

			throw redirect(303, '/admin/replies?sent=1');
		}

		const note = await createLocalNote(event, {
			contentHtml,
			contentText: content,
			attachments
		});

		if (!note) {
			throw error(500, 'Unable to create note');
		}

		await deliverLocalNoteToFollowers(event, note);
		await updateLocalReplyDeliveryStatus(event, note.localSlug || '', 'delivered');
		throw redirect(303, '/admin?posted=1');
	}
};
