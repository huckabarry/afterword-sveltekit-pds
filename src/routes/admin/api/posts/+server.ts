import { json } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { listLocalNotes } from '$lib/server/ap-notes';
import { requireAdminAccess } from '$lib/server/admin';
import { getStatuses } from '$lib/server/atproto';

export async function GET(event) {
	await requireAdminAccess(event);

	const origin = getActivityPubOrigin(event);
	const localPosts = await listLocalNotes(event, 200);
	const mirroredStatuses = (await getStatuses()).slice(0, 50).map((post) => ({
		id: post.id,
		slug: post.slug,
		apObjectId: `${origin}/ap/status/${post.slug}`,
		text: post.text,
		displayName: post.displayName,
		handle: post.handle,
		blueskyUrl: post.blueskyUrl,
		date: post.date.toISOString(),
		replyCount: post.replyCount,
		repostCount: post.repostCount,
		likeCount: post.likeCount
	}));

	return json({
		localPosts: localPosts.map((post) => ({
			id: post.id,
			noteId: post.noteId,
			localSlug: post.localSlug,
			contentText: post.contentText,
			publishedAt: post.publishedAt,
			inReplyToObjectId: post.inReplyToObjectId,
			incomingReplyCount: post.incomingReplyCount,
			deliveryStatus: post.deliveryStatus
		})),
		mirroredStatuses
	});
}
