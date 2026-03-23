import { error } from '@sveltejs/kit';
import { getLocalReplyBySlug } from '$lib/server/ap-notes';
import { localReplyToNote, replyJson } from '$lib/server/activitypub-replies';

export async function GET(event) {
	const note = await getLocalReplyBySlug(event, event.params.slug);

	if (!note || note.origin !== 'local' || note.inReplyToObjectId) {
		throw error(404, 'Note not found');
	}

	return replyJson(await localReplyToNote(note, event.url.origin));
}
