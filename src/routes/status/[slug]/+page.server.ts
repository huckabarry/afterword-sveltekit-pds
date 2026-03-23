import { error } from '@sveltejs/kit';
import { getStatusBySlug } from '$lib/server/atproto';
import { getInteractionSummary } from '$lib/server/interactions';
import { getStatusObjectId } from '$lib/server/activitypub';
import { listDirectRepliesToObject } from '$lib/server/ap-notes';
import { enrichReplies } from '$lib/server/activitypub-reply-previews';

function dedupeReplies<T extends { actorId: string; contentHtml: string; inReplyToObjectId: string | null }>(
	replies: T[]
) {
	const seen = new Set<string>();

	return replies.filter((reply) => {
		const key = [
			reply.actorId,
			reply.inReplyToObjectId || '',
			reply.contentHtml.replace(/\s+/g, ' ').trim()
		].join('::');

		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	});
}

export async function load(event) {
	const { params } = event;
	const post = await getStatusBySlug(params.slug);

	if (!post) {
		throw error(404, 'Status post not found');
	}

	const statusObjectId = getStatusObjectId(event.url.origin, post.slug);
	const fediverse = await getInteractionSummary(event, statusObjectId);
	const apReplies = dedupeReplies(await listDirectRepliesToObject(event, statusObjectId));
	const replies = await enrichReplies(event, apReplies);

	return { post, fediverse, apReplies: replies, origin: event.url.origin };
}
