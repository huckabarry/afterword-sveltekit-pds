import { error } from '@sveltejs/kit';
import { getStatusBySlug } from '$lib/server/atproto';
import { getInteractionSummary } from '$lib/server/interactions';
import { getStatusObjectId } from '$lib/server/activitypub';
import { listNotesForThread } from '$lib/server/ap-notes';

export async function load(event) {
	const { params } = event;
	const post = await getStatusBySlug(params.slug);

	if (!post) {
		throw error(404, 'Status post not found');
	}

	const statusObjectId = getStatusObjectId(event.url.origin, post.slug);
	const fediverse = await getInteractionSummary(event, statusObjectId);
	const apReplies = await listNotesForThread(event, statusObjectId);

	return { post, fediverse, apReplies };
}
