import { error, fail, redirect } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { createLocalNote, updateLocalReplyDeliveryStatus } from '$lib/server/ap-notes';
import { createAdminSession, getAdminPassword, hasAdminSession } from '$lib/server/admin';
import { listFollowers } from '$lib/server/followers';
import { localReplyToCreateActivity, normalizeMentionText, textToParagraphHtml } from '$lib/server/activitypub-replies';
import { uploadRemoteImageUrls } from '$lib/server/media';
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

function buildPrefillText(url: URL) {
	const pieces = [url.searchParams.get('title'), url.searchParams.get('text'), url.searchParams.get('url')]
		.map((item) => String(item || '').trim())
		.filter(Boolean);

	return pieces.join(pieces.length > 1 ? '\n\n' : '').trim();
}

function extractImageUrls(content: string) {
	const matches = String(content || '').match(/https?:\/\/\S+/g) || [];
	return matches.filter((item) => /\.(jpe?g|png|gif|webp)(\?.*)?$/i.test(item));
}

export const load: PageServerLoad = async ({ url, cookies }) => {
	return {
		prefill: buildPrefillText(url),
		loggedIn: await hasAdminSession(cookies)
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const originalContent = normalizeMentionText(String(form.get('content') || '').trim());
		const password = String(form.get('password') || '').trim();
		const loggedIn = await hasAdminSession(event.cookies);
		const imageUrls = extractImageUrls(originalContent);
		const importedAttachments = await uploadRemoteImageUrls(event, imageUrls, {
			scope: 'ap-notes',
			prefix: 'share'
		});
		const content = normalizeMentionText(
			originalContent
				.replace(/https?:\/\/\S+/g, (match) =>
					imageUrls.includes(match) ? '' : match
				)
				.replace(/\n{3,}/g, '\n\n')
				.trim()
		);

		if (!content && importedAttachments.length === 0) {
			return fail(400, {
				error: 'Write something before publishing.',
				content: originalContent,
				loggedIn
			});
		}

		if (!loggedIn) {
			const expected = getAdminPassword();
			if (!expected || password !== expected) {
				return fail(401, {
					error: 'Enter your admin password to publish.',
					content: originalContent,
					loggedIn: false
				});
			}

			await createAdminSession(event.cookies);
		}

		const contentHtml = textToParagraphHtml(content);
		const note = await createLocalNote(event, {
			contentHtml,
			contentText: content,
			attachments: importedAttachments
		});

		if (!note) {
			throw error(500, 'Unable to create note');
		}

		await deliverLocalNoteToFollowers(event, note);
		await updateLocalReplyDeliveryStatus(event, note.localSlug || '', 'delivered');
		throw redirect(303, `/admin/posts/${note.localSlug}?shared=1`);
	}
};
