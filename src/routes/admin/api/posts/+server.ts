import { json } from '@sveltejs/kit';
import { getActivityPubHandle, getActivityPubOrigin } from '$lib/server/activitypub';
import { listLocalNotes } from '$lib/server/ap-notes';
import { requireAdminAccess } from '$lib/server/admin';
import { getStatuses } from '$lib/server/atproto';
import { getSiteProfile } from '$lib/server/profile';

export async function GET(event) {
	await requireAdminAccess(event);

	const origin = getActivityPubOrigin(event);
	const localPosts = await listLocalNotes(event, 200);
	const profile = await getSiteProfile(event);
	const mirroredStatuses = (await getStatuses()).slice(0, 50).map((post) => ({
		id: post.id,
		slug: post.slug,
		apObjectId: `${origin}/ap/status/${post.slug}`,
		text: post.text,
		displayName: post.displayName,
		handle: post.handle,
		blueskyUrl: post.blueskyUrl,
		date: post.date.toISOString(),
		avatarUrl: post.avatar,
		replyCount: post.replyCount,
		repostCount: post.repostCount,
		likeCount: post.likeCount,
		images: post.images
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
			deliveryStatus: post.deliveryStatus,
			attachments: post.attachments,
			actorName: profile.displayName,
			actorHandle: getActivityPubHandle(origin),
			avatarUrl: profile.avatarUrl.startsWith('http')
				? profile.avatarUrl
				: `${origin}${profile.avatarUrl}`
		})),
		mirroredStatuses
	});
}
