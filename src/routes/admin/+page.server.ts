import { error, fail, redirect } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { countFollowing } from '$lib/server/activitypub-follows';
import { countDirectMessages, createLocalNote, updateLocalReplyDeliveryStatus } from '$lib/server/ap-notes';
import { listFollowers, countFollowers } from '$lib/server/followers';
import { uploadImageFiles } from '$lib/server/media';
import { textToParagraphHtml, normalizeMentionText, localReplyToCreateActivity } from '$lib/server/activitypub-replies';
import { countWebmentions } from '$lib/server/webmentions';
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
		posted: event.url.searchParams.get('posted') === '1'
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const content = normalizeMentionText(String(form.get('content') || '').trim());
		const imageFiles = form
			.getAll('images')
			.filter((value): value is File => value instanceof File && value.size > 0);

		if (!content) {
			return fail(400, {
				error: 'Write something before publishing.',
				content
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
