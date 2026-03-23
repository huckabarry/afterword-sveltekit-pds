import { error } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { getLocalReplyBySlug } from '$lib/server/ap-notes';
import { localReplyToNote, replyJson } from '$lib/server/activitypub-replies';

export async function GET(event) {
	const reply = await getLocalReplyBySlug(event, event.params.slug);

	if (!reply || reply.origin !== 'local') {
		throw error(404, 'Reply not found');
	}

	return replyJson(await localReplyToNote(reply, getActivityPubOrigin(event)));
}
