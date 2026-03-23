import { error, fail, redirect } from '@sveltejs/kit';
import { getBlogPostBySlug } from '$lib/server/ghost';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { createLocalReply, getLocalReplyBySlug, listRecentRemoteReplies, updateLocalReplyDeliveryStatus } from '$lib/server/ap-notes';
import { deliverLikeToRemoteObject } from '$lib/server/activitypub-likes';
import { getStatusBySlug } from '$lib/server/atproto';
import {
	deliverReplyToRemoteActor,
	fetchActivityJson,
	localReplyToCreateActivity,
	resolveThreadRootObjectId,
	textToParagraphHtml
} from '$lib/server/activitypub-replies';
import type { Actions, PageServerLoad } from './$types';

type ReplyContext = {
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

async function resolveReplyContext(event: Parameters<PageServerLoad>[0], origin: string, objectId: string): Promise<ReplyContext | null> {
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

export const load: PageServerLoad = async (event) => {
	const origin = getActivityPubOrigin(event);
	const replies = await listRecentRemoteReplies(event, 50);
	const repliesWithContext = await Promise.all(
		replies.map(async (reply) => ({
			...reply,
			replyContext: reply.inReplyToObjectId ? await resolveReplyContext(event, origin, reply.inReplyToObjectId) : null
		}))
	);

	return {
		replies: repliesWithContext,
		sent: event.url.searchParams.get('sent') === '1',
		liked: event.url.searchParams.get('liked') === '1'
	};
};

export const actions: Actions = {
	reply: async (event) => {
		const form = await event.request.formData();
		const replyTo = String(form.get('replyTo') || '').trim();
		const content = String(form.get('content') || '').trim();

		if (!replyTo || !content) {
			return fail(400, { error: 'Reply target and content are required.' });
		}

		const origin = getActivityPubOrigin(event);
		const threadRootObjectId = await resolveThreadRootObjectId(replyTo, origin);
		const contentHtml = textToParagraphHtml(content);
		const reply = await createLocalReply(event, {
			inReplyToObjectId: replyTo,
			threadRootObjectId,
			contentHtml,
			contentText: content
		});

		if (!reply) {
			throw error(500, 'Unable to create reply');
		}

		try {
			const activity = localReplyToCreateActivity(reply, origin);
			await deliverReplyToRemoteActor(origin, replyTo, activity);
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', 'delivered');
		} catch (deliveryError) {
			const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', `failed:${message}`);
			throw deliveryError;
		}

		throw redirect(303, '/admin/replies?sent=1');
	},
	like: async (event) => {
		const form = await event.request.formData();
		const objectId = String(form.get('objectId') || '').trim();

		if (!objectId) {
			return fail(400, { error: 'Missing object to like.' });
		}

		await deliverLikeToRemoteObject(getActivityPubOrigin(event), objectId);
		throw redirect(303, '/admin/replies?liked=1');
	}
};
