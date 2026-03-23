import { env } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';
import { getBlogPostBySlug, getBlogPosts, type BlogPost } from '$lib/server/ghost';

const ACTIVITY_STREAMS_CONTEXT = 'https://www.w3.org/ns/activitystreams';
const PUBLIC_COLLECTION = 'https://www.w3.org/ns/activitystreams#Public';
const ACTOR_PATH = '/ap/actor';
const OUTBOX_PATH = '/ap/outbox';
const INBOX_PATH = '/ap/inbox';
const FOLLOWERS_PATH = '/ap/followers';
const FOLLOWING_PATH = '/ap/following';
const DEFAULT_USERNAME = 'bryan';
const ALT_USERNAME = 'afterword';

export function getActivityPubOrigin(event: Pick<RequestEvent, 'url'>) {
	return event.url.origin;
}

export function getActorId(origin: string) {
	return `${origin}${ACTOR_PATH}`;
}

export function getInboxId(origin: string) {
	return `${origin}${INBOX_PATH}`;
}

export function getFollowersId(origin: string) {
	return `${origin}${FOLLOWERS_PATH}`;
}

export function getActorAliases(origin: string) {
	const host = new URL(origin).host;
	return [`acct:${DEFAULT_USERNAME}@${host}`, `acct:${ALT_USERNAME}@${host}`];
}

export function getActivityPubHandle(origin: string) {
	const host = new URL(origin).host;
	return `${DEFAULT_USERNAME}@${host}`;
}

export function getPreferredUsername() {
	return DEFAULT_USERNAME;
}

export function getActivityPubKeyId(origin: string) {
	return String(env.ACTIVITYPUB_KEY_ID || '').trim() || `${getActorId(origin)}#main-key`;
}

export function getActivityPubPublicKeyPem() {
	return String(env.ACTIVITYPUB_PUBLIC_KEY_PEM || '').trim() || null;
}

export function getActivityPubPrivateKeyPem() {
	return String(env.ACTIVITYPUB_PRIVATE_KEY_PEM || '').trim() || null;
}

export function getNoteObjectId(origin: string, slug: string) {
	return `${origin}/ap/posts/${slug}`;
}

export function activityJson(body: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(body, null, 2), {
		...init,
		headers: {
			'content-type': 'application/activity+json; charset=utf-8',
			...(init?.headers || {})
		}
	});
}

export function jrdJson(body: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(body, null, 2), {
		...init,
		headers: {
			'content-type': 'application/jrd+json; charset=utf-8',
			...(init?.headers || {})
		}
	});
}

export function createActor(origin: string) {
	const actorId = getActorId(origin);
	const publicKeyPem = getActivityPubPublicKeyPem();

	return {
		'@context': [ACTIVITY_STREAMS_CONTEXT, 'https://w3id.org/security/v1'],
		id: actorId,
		type: 'Person',
		preferredUsername: DEFAULT_USERNAME,
		name: 'Bryan Robb',
		summary: 'Writer, photographer, and urban planner publishing from Afterword.',
		url: `${origin}/`,
		icon: {
			type: 'Image',
			mediaType: 'image/jpeg',
			url: `${origin}/assets/images/status-avatar.jpg`
		},
		inbox: `${origin}${INBOX_PATH}`,
		outbox: `${origin}${OUTBOX_PATH}`,
		followers: `${origin}${FOLLOWERS_PATH}`,
		following: `${origin}${FOLLOWING_PATH}`,
		...(publicKeyPem
			? {
					publicKey: {
						id: getActivityPubKeyId(origin),
						owner: actorId,
						publicKeyPem
					}
				}
			: {})
	};
}

export function createAcceptActivity(origin: string, followActivity: Record<string, unknown>) {
	const actorId = getActorId(origin);
	const objectId = String(followActivity.id || '').trim() || `${actorId}#follow`;

	return {
		'@context': ACTIVITY_STREAMS_CONTEXT,
		id: `${objectId}#accept`,
		type: 'Accept',
		actor: actorId,
		object: followActivity
	};
}

function stripHtmlToText(html: string) {
	return String(html || '')
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

export function blogPostToArticle(post: BlogPost, origin: string) {
	const actorId = getActorId(origin);
	const objectId = getNoteObjectId(origin, post.slug);

	return {
		'@context': ACTIVITY_STREAMS_CONTEXT,
		id: objectId,
		type: 'Article',
		attributedTo: actorId,
		published: post.publishedAt.toISOString(),
		updated: post.updatedAt.toISOString(),
		url: `${origin}${post.path}`,
		to: [PUBLIC_COLLECTION],
		cc: [`${origin}${FOLLOWERS_PATH}`],
		name: post.title,
		summary: post.excerpt,
		content: post.html,
		contentMap: {
			en: post.html
		},
		mediaType: 'text/html',
		tag: post.publicTags.map((tag) => ({
			type: 'Hashtag',
			name: `#${tag.label.replace(/\s+/g, '')}`,
			href: `${origin}${tag.path}`
		})),
		attachment: post.coverImage
			? [
					{
						type: 'Image',
						url: post.coverImage,
						name: post.title
					}
				]
			: [],
		source: {
			content: stripHtmlToText(post.html),
			mediaType: 'text/plain'
		}
	};
}

export function blogPostToCreateActivity(post: BlogPost, origin: string) {
	const actorId = getActorId(origin);
	const object = blogPostToArticle(post, origin);

	return {
		'@context': ACTIVITY_STREAMS_CONTEXT,
		id: `${object.id}#create`,
		type: 'Create',
		actor: actorId,
		published: post.publishedAt.toISOString(),
		to: [PUBLIC_COLLECTION],
		cc: [`${origin}${FOLLOWERS_PATH}`],
		object
	};
}

export async function getOutboxPage(origin: string, pageNumber = 1, pageSize = 10) {
	const posts = await getBlogPosts();
	const start = Math.max(0, (pageNumber - 1) * pageSize);
	const items = posts.slice(start, start + pageSize).map((post) => blogPostToCreateActivity(post, origin));
	const totalItems = posts.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

	return {
		totalItems,
		totalPages,
		items
	};
}

export async function getActivityObjectBySlug(slug: string, origin: string) {
	const post = await getBlogPostBySlug(slug);
	if (!post) return null;
	return blogPostToArticle(post, origin);
}
