import { error } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { getLocalReplyBySlug } from '$lib/server/ap-notes';
import { localReplyToNote, replyJson } from '$lib/server/activitypub-replies';

export async function GET(event) {
	const note = await getLocalReplyBySlug(event, event.params.slug);

	if (!note || note.origin !== 'local') {
		throw error(404, 'Note not found');
	}

	return replyJson(localReplyToNote(note, getActivityPubOrigin(event)));
}
