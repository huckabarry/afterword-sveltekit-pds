import type { RequestEvent } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { countDirectRepliesToObject, listLocalNotes } from '$lib/server/ap-notes';
import { getStatuses } from '$lib/server/atproto';
import { getSiteProfile } from '$lib/server/profile';

export type AdminPostFeedItem = {
	id: string;
	source: 'local' | 'mirrored';
	visibility: 'public' | 'followers' | 'direct';
	publishedAt: string;
	actorName: string;
	actorHandle: string;
	actorAvatarUrl: string;
	contentText: string;
	attachments: Array<{
		url: string;
		alt: string;
	}>;
	replyCount: number;
	deliveryStatus: string | null;
	openHref: string;
	publicHref: string | null;
	replyHref: string | null;
	sourceHref: string | null;
};

export async function buildAdminPostFeed(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	options?: {
		localLimit?: number;
		mirroredLimit?: number;
	}
): Promise<AdminPostFeedItem[]> {
	const origin = getActivityPubOrigin(event);
	const [profile, localPosts, mirroredStatuses] = await Promise.all([
		getSiteProfile(event),
		listLocalNotes(event, options?.localLimit ?? 200),
		getStatuses()
	]);
	const actorHandle = `@${new URL(origin).hostname}`;
	const actorAvatarUrl = profile.avatarUrl.startsWith('http')
		? profile.avatarUrl
		: `${origin}${profile.avatarUrl}`;

	const mirrored = await Promise.all(
		mirroredStatuses.slice(0, options?.mirroredLimit ?? 50).map(async (post) => {
			const objectId = `${origin}/ap/status/${post.slug}`;

			return {
				id: objectId,
				source: 'mirrored' as const,
				visibility: 'public' as const,
				publishedAt: post.date.toISOString(),
				actorName: post.displayName,
				actorHandle: post.handle,
				actorAvatarUrl: post.avatar || '/assets/images/status-avatar.jpg',
				contentText: post.text,
				attachments: post.images.map((image) => ({
					url: image.fullsize || image.thumb,
					alt: image.alt || ''
				})),
				replyCount: await countDirectRepliesToObject(event, objectId),
				deliveryStatus: null,
				openHref: `/status/${post.slug}`,
				publicHref: `${origin}/status/${post.slug}`,
				replyHref: `/admin/compose?replyTo=${encodeURIComponent(objectId)}`,
				sourceHref: post.blueskyUrl
			};
		})
	);

	const local = localPosts.map((post) => ({
		id: post.noteId,
		source: 'local' as const,
		visibility: post.visibility,
		publishedAt: post.publishedAt,
		actorName: profile.displayName,
		actorHandle,
		actorAvatarUrl,
		contentText: post.contentText,
		attachments: post.attachments.map((attachment) => ({
			url: attachment.url,
			alt: attachment.alt || ''
		})),
		replyCount: post.incomingReplyCount,
		deliveryStatus: post.deliveryStatus,
		openHref: post.localSlug ? `/admin/posts/${post.localSlug}` : '/admin/posts',
		publicHref: post.objectUrl || post.noteId,
		replyHref: null,
		sourceHref: null
	}));

	return [...local, ...mirrored].sort(
		(a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
	);
}
