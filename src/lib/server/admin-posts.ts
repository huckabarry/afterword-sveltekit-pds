import { getStatuses } from '$lib/server/atproto';

export type AdminPostFeedItem = {
	id: string;
	uri: string;
	slug: string;
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
	quoteCount: number;
	likeCount: number;
	openHref: string;
	sourceHref: string;
};

export async function buildAdminPostFeed() {
	const statuses = await getStatuses();

	return statuses.map((post) => ({
		id: post.uri,
		uri: post.uri,
		slug: post.slug,
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
		quoteCount: post.quoteCount,
		likeCount: post.likeCount,
		openHref: `/status/${post.slug}`,
		sourceHref: post.blueskyUrl
	}));
}
