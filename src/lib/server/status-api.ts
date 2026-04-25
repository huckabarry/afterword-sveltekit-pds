import type { StatusFeedPage, StatusPost } from '$lib/server/atproto';

export type SerializedStatusImage = {
	thumb: string;
	fullsize: string;
	alt: string;
};

export type SerializedStatusExternal = {
	uri: string;
	title: string;
	description: string;
	domain: string;
	thumb: string;
};

export type SerializedStatusVideo = {
	playlist: string;
	thumbnail: string;
	alt: string;
	width: number;
	height: number;
};

export type SerializedStatusQuotedPost = {
	uri: string;
	date: string;
	blueskyUrl: string;
	displayName: string;
	handle: string;
	avatar: string;
	text: string;
	html: string;
	images: SerializedStatusImage[];
	external: SerializedStatusExternal | null;
	video: SerializedStatusVideo | null;
};

export type SerializedStatusReplyTo = {
	uri: string | null;
	displayName: string;
	handle: string;
	blueskyUrl: string;
};

export type SerializedStatusPost = {
	id: string;
	uri: string;
	slug: string;
	text: string;
	html: string;
	date: string;
	blueskyUrl: string;
	displayName: string;
	handle: string;
	avatar: string;
	isReply: boolean;
	replyCount: number;
	repostCount: number;
	quoteCount: number;
	likeCount: number;
	images: SerializedStatusImage[];
	external: SerializedStatusExternal | null;
	video: SerializedStatusVideo | null;
	quotedPost: SerializedStatusQuotedPost | null;
	replyTo: SerializedStatusReplyTo | null;
	replies: SerializedStatusPost[];
};

export type SerializedStatusFeedPage = {
	statuses: SerializedStatusPost[];
	cursor: string | null;
	limit: number;
};

function serializeStatusPost(post: StatusPost): SerializedStatusPost {
	return {
		id: post.id,
		uri: post.uri,
		slug: post.slug,
		text: post.text,
		html: post.html,
		date: post.date.toISOString(),
		blueskyUrl: post.blueskyUrl,
		displayName: post.displayName,
		handle: post.handle,
		avatar: post.avatar,
		isReply: post.isReply,
		replyCount: post.replyCount,
		repostCount: post.repostCount,
		quoteCount: post.quoteCount,
		likeCount: post.likeCount,
		images: post.images.map((image) => ({
			thumb: image.thumb,
			fullsize: image.fullsize,
			alt: image.alt
		})),
		external: post.external
			? {
					uri: post.external.uri,
					title: post.external.title,
					description: post.external.description,
					domain: post.external.domain,
					thumb: post.external.thumb
				}
			: null,
		video: post.video
			? {
					playlist: post.video.playlist,
					thumbnail: post.video.thumbnail,
					alt: post.video.alt,
					width: post.video.width,
					height: post.video.height
				}
			: null,
		quotedPost: post.quotedPost
			? {
					uri: post.quotedPost.uri,
					date: post.quotedPost.date.toISOString(),
					blueskyUrl: post.quotedPost.blueskyUrl,
					displayName: post.quotedPost.displayName,
					handle: post.quotedPost.handle,
					avatar: post.quotedPost.avatar,
					text: post.quotedPost.text,
					html: post.quotedPost.html,
					images: post.quotedPost.images.map((image) => ({
						thumb: image.thumb,
						fullsize: image.fullsize,
						alt: image.alt
					})),
					external: post.quotedPost.external
						? {
								uri: post.quotedPost.external.uri,
								title: post.quotedPost.external.title,
								description: post.quotedPost.external.description,
								domain: post.quotedPost.external.domain,
								thumb: post.quotedPost.external.thumb
							}
						: null,
					video: post.quotedPost.video
						? {
								playlist: post.quotedPost.video.playlist,
								thumbnail: post.quotedPost.video.thumbnail,
								alt: post.quotedPost.video.alt,
								width: post.quotedPost.video.width,
								height: post.quotedPost.video.height
							}
						: null
				}
			: null,
		replyTo: post.replyTo
			? {
					uri: post.replyTo.uri,
					displayName: post.replyTo.displayName,
					handle: post.replyTo.handle,
					blueskyUrl: post.replyTo.blueskyUrl
				}
			: null,
		replies: Array.isArray(post.replies) ? post.replies.map((reply) => serializeStatusPost(reply)) : []
	};
}

export function serializeStatusFeedPage(page: StatusFeedPage): SerializedStatusFeedPage {
	return {
		statuses: page.statuses.map((status) => serializeStatusPost(status)),
		cursor: page.cursor,
		limit: page.limit
	};
}

export function serializeStatusPostDetail(post: StatusPost) {
	return {
		post: serializeStatusPost(post)
	};
}
