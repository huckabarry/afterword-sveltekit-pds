import { error, json } from '@sveltejs/kit';
import { deleteLocalNoteBySlug, getNoteById, updateLocalNoteBySlug } from '$lib/server/ap-notes';
import { textToParagraphHtml } from '$lib/server/activitypub-replies';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { decodeMastodonStatusId, resolveStatusByObjectId } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const objectId = decodeMastodonStatusId(event.params.id);
	if (!objectId) {
		throw error(404, 'Unknown status');
	}

	const status = await resolveStatusByObjectId(event, objectId);
	if (!status) {
		throw error(404, 'Unknown status');
	}

	return json(status);
}

export async function PUT(event) {
	await requireMastodonAccessToken(event);

	const objectId = decodeMastodonStatusId(event.params.id);
	if (!objectId) throw error(404, 'Unknown status');

	const note = await getNoteById(event, objectId);
	if (!note?.localSlug || note.origin !== 'local') {
		throw error(403, 'Only local statuses can be edited');
	}

	const body = await event.request.json().catch(() => ({}));
	const content = String(body.status || '').trim();
	if (!content) {
		throw error(400, 'status is required');
	}

	await updateLocalNoteBySlug(event, note.localSlug, {
		contentHtml: textToParagraphHtml(content),
		contentText: content,
		attachments: note.attachments
	});

	const updated = await resolveStatusByObjectId(event, objectId);
	if (!updated) throw error(404, 'Unknown status');
	return json(updated);
}

export async function DELETE(event) {
	await requireMastodonAccessToken(event);

	const objectId = decodeMastodonStatusId(event.params.id);
	if (!objectId) throw error(404, 'Unknown status');

	const note = await getNoteById(event, objectId);
	if (!note?.localSlug || note.origin !== 'local') {
		throw error(403, 'Only local statuses can be deleted');
	}

	await deleteLocalNoteBySlug(event, note.localSlug);
	return json({});
}
