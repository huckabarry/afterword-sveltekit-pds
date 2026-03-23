import { getBlogPostBySlug } from '$lib/server/ghost';
import { getStatusBySlug } from '$lib/server/atproto';
import { getLocalReplyBySlug } from '$lib/server/ap-notes';
import { fetchActivityJson } from '$lib/server/activitypub-replies';

export type ReplyContext = {
	objectId: string;
	url: string;
	title: string | null;
	author: string | null;
	excerpt: string;
};

function stripHtml(value: string) {
	return String(value || '')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

function compactText(value: string, max = 220) {
	const text = stripHtml(value);
	return text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text;
}

export async function resolveReplyContext(
	event: { platform: App.Platform | undefined; url: URL },
	origin: string,
	objectId: string
): Promise<ReplyContext | null> {
	const url = String(objectId || '').trim();
	if (!url) return null;

	const statusPrefix = `${origin}/ap/status/`;
	if (url.startsWith(statusPrefix)) {
		const slug = url.slice(statusPrefix.length);
		const post = await getStatusBySlug(slug);
		if (!post) return null;

		return {
			objectId: url,
			url: `${origin}/status/${slug}`,
			title: 'Mirrored Bluesky post',
			author: post.displayName || post.handle,
			excerpt: compactText(post.text)
		};
	}

	const replyPrefix = `${origin}/ap/replies/`;
	if (url.startsWith(replyPrefix)) {
		const slug = url.slice(replyPrefix.length);
		const note = await getLocalReplyBySlug(event, slug).catch(() => null);
		if (!note) return null;

		return {
			objectId: url,
			url,
			title: 'Local ActivityPub reply',
			author: 'Bryan Robb',
			excerpt: compactText(note.contentText)
		};
	}

	const notePrefix = `${origin}/ap/notes/`;
	if (url.startsWith(notePrefix)) {
		const slug = url.slice(notePrefix.length);
		const note = await getLocalReplyBySlug(event, slug).catch(() => null);
		if (!note) return null;

		return {
			objectId: url,
			url,
			title: 'Local ActivityPub note',
			author: 'Bryan Robb',
			excerpt: compactText(note.contentText)
		};
	}

	const blogPrefix = `${origin}/ap/posts/`;
	if (url.startsWith(blogPrefix)) {
		const slug = url.slice(blogPrefix.length);
		const post = await getBlogPostBySlug(slug);
		if (!post) return null;

		return {
			objectId: url,
			url: `${origin}${post.path}`,
			title: post.title,
			author: 'Bryan Robb',
			excerpt: compactText(post.excerpt || post.html)
		};
	}

	try {
		const remote = await fetchActivityJson(url);
		const content =
			(typeof remote.content === 'string' && remote.content) ||
			(typeof remote.summary === 'string' && remote.summary) ||
			(typeof remote.name === 'string' && remote.name) ||
			(typeof remote.source === 'object' &&
			remote.source &&
			'content' in remote.source &&
			typeof remote.source.content === 'string'
				? remote.source.content
				: '') ||
			'';

		return {
			objectId: url,
			url: (typeof remote.url === 'string' && remote.url) || url,
			title: typeof remote.name === 'string' && remote.name ? remote.name : 'Remote ActivityPub post',
			author:
				(typeof remote.attributedTo === 'string' && remote.attributedTo) ||
				(typeof remote.actor === 'string' && remote.actor) ||
				null,
			excerpt: compactText(content || url)
		};
	} catch {
		return {
			objectId: url,
			url,
			title: 'Reply target',
			author: null,
			excerpt: url
		};
	}
}
