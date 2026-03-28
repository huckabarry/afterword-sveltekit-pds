import { getStatuses } from '$lib/server/atproto';

export type AdminPostFeedItem = {
	id: string;
	source: 'bluesky';
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
	repostCount: number;
	likeCount: number;
	openHref: string;
	sourceHref: string;
};

export async function buildAdminPostFeed() {
	const statuses = await getStatuses();

	return statuses.map((post) => ({
		id: post.uri,
		source: 'bluesky' as const,
		publishedAt: post.date.toISOString(),
		actorName: post.displayName,
		actorHandle: post.handle,
		actorAvatarUrl: post.avatar || '/assets/images/status-avatar.jpg',
		contentText: post.text,
		attachments: post.images.map((image) => ({
			url: image.fullsize || image.thumb,
			alt: image.alt || ''
		})),
		replyCount: post.replyCount,
		repostCount: post.repostCount,
		likeCount: post.likeCount,
		openHref: `/status/${post.slug}`,
		sourceHref: post.blueskyUrl
	}));
}
