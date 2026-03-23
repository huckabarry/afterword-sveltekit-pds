import { error, fail, redirect } from '@sveltejs/kit';
import {
	deleteLocalNoteBySlug,
	getLocalReplyBySlug,
	listDirectRepliesToObject,
	updateLocalNoteBySlug
} from '$lib/server/ap-notes';
import { textToParagraphHtml } from '$lib/server/activitypub-replies';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const post = await getLocalReplyBySlug(event, event.params.slug);

	if (!post || post.origin !== 'local') {
		throw error(404, 'Local post not found');
	}

	const replies = await listDirectRepliesToObject(event, post.noteId);

	return {
		post,
		replies
	};
};

export const actions: Actions = {
	save: async (event) => {
		const post = await getLocalReplyBySlug(event, event.params.slug);
		if (!post || post.origin !== 'local') {
			throw error(404, 'Local post not found');
		}

		const form = await event.request.formData();
		const content = String(form.get('content') || '').trim();

		if (!content) {
			return fail(400, { error: 'Content is required.' });
		}

		await updateLocalNoteBySlug(event, event.params.slug, {
			contentHtml: textToParagraphHtml(content),
			contentText: content
		});

		throw redirect(303, '/admin/posts?saved=1');
	},
	delete: async (event) => {
		await deleteLocalNoteBySlug(event, event.params.slug);
		throw redirect(303, '/admin/posts?deleted=1');
	}
};
