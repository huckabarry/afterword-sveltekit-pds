import { error, fail, redirect } from '@sveltejs/kit';
import { countFollowing } from '$lib/server/activitypub-follows';
import {
	countDirectMessages,
	createLocalNote,
	normalizeApNoteVisibility,
	updateLocalReplyDeliveryStatus
} from '$lib/server/ap-notes';
import { countFollowers } from '$lib/server/followers';
import { uploadImageFiles } from '$lib/server/media';
import {
	deliverLocalCreateActivity,
	textToParagraphHtml,
	normalizeMentionText
} from '$lib/server/activitypub-replies';
import { countWebmentions } from '$lib/server/webmentions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const [followingCount, followerCount, webmentionCount, messageCount] = await Promise.all([
		countFollowing(event),
		countFollowers(event),
		countWebmentions(event),
		countDirectMessages(event)
	]);

	return {
		stats: {
			followingCount,
			followerCount,
			webmentionCount,
			messageCount
		},
		posted: event.url.searchParams.get('posted') === '1',
		sent: event.url.searchParams.get('sent') === '1',
		compose: {
			visibility: normalizeApNoteVisibility(event.url.searchParams.get('visibility')),
			directTo: String(event.url.searchParams.get('directTo') || '').trim(),
			directLabel: String(event.url.searchParams.get('directLabel') || '').trim()
		}
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const content = normalizeMentionText(String(form.get('content') || '').trim());
		const visibility = normalizeApNoteVisibility(form.get('visibility'));
		const directTo = String(form.get('directTo') || '').trim();
		const imageFiles = form
			.getAll('images')
			.filter((value): value is File => value instanceof File && value.size > 0);

		if (!content) {
			return fail(400, {
				error: 'Write something before publishing.',
				content,
				visibility,
				directTo
			});
		}

		if (visibility === 'direct' && !directTo) {
			return fail(400, {
				error: 'Choose a recipient before sending a direct message.',
				content,
				visibility,
				directTo
			});
		}

		const contentHtml = textToParagraphHtml(content);
		const attachments = await uploadImageFiles(event, imageFiles, {
			scope: 'ap-notes',
			prefix: 'note'
		});

		const note = await createLocalNote(event, {
			contentHtml,
			contentText: content,
			visibility,
			directRecipientActorId: visibility === 'direct' ? directTo : null,
			attachments
		});

		if (!note) {
			throw error(500, 'Unable to create note');
		}

		await deliverLocalCreateActivity(event, note);
		await updateLocalReplyDeliveryStatus(event, note.localSlug || '', 'delivered');
		throw redirect(303, visibility === 'direct' ? '/admin?sent=1' : '/admin?posted=1');
	}
};
