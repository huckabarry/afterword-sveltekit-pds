import { error, json } from '@sveltejs/kit';
import {
	deleteLocalNoteBySlug,
	getLocalReplyBySlug,
	listDirectRepliesToObject,
	updateLocalNoteBySlug
} from '$lib/server/ap-notes';
import { requireAdminAccess } from '$lib/server/admin';
import { textToParagraphHtml } from '$lib/server/activitypub-replies';

function normalizeAttachments(value: unknown) {
	if (!Array.isArray(value)) return [];

	return value
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
			(
				item
			): item is {
				url: string;
				mediaType: string;
				alt: string;
			} => Boolean(item)
		);
}

export async function GET(event) {
	await requireAdminAccess(event);

	const post = await getLocalReplyBySlug(event, event.params.slug);
	if (!post || post.origin !== 'local') {
		throw error(404, 'Local post not found');
	}

	const replies = await listDirectRepliesToObject(event, post.noteId);

	return json({
		post,
		replies: replies.map((reply) => ({
			noteId: reply.noteId,
			actorId: reply.actorId,
			actorName: reply.actorName,
			actorHandle: reply.actorHandle,
			contentText: reply.contentText,
			publishedAt: reply.publishedAt,
			objectUrl: reply.objectUrl
		}))
	});
}

export async function POST(event) {
	await requireAdminAccess(event);

	const body = await event.request.json().catch(() => null);
	const intent = String(body?.intent || 'save').trim();

	const post = await getLocalReplyBySlug(event, event.params.slug);
	if (!post || post.origin !== 'local') {
		throw error(404, 'Local post not found');
	}

	if (intent === 'delete') {
		await deleteLocalNoteBySlug(event, event.params.slug);
		return json({ ok: true });
	}

	const content = String(body?.content || '').trim();
	if (!content) {
		return json({ error: 'Content is required.' }, { status: 400 });
	}

	const attachments = normalizeAttachments(body?.attachments);

	await updateLocalNoteBySlug(event, event.params.slug, {
		contentHtml: textToParagraphHtml(content),
		contentText: content,
		attachments
	});

	const updated = await getLocalReplyBySlug(event, event.params.slug);
	return json({
		ok: true,
		post: updated
	});
}
