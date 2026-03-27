import { error, type RequestEvent } from '@sveltejs/kit';
import { activityJson, getActorId } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { getLocalReplyBySlug } from '$lib/server/ap-notes';
import { listFollowers } from '$lib/server/followers';
import type { ApNoteRecord } from '$lib/server/ap-notes';

type RemoteActor = {
	id: string;
	name: string | null;
	handle: string | null;
	inboxUrl: string | null;
	sharedInboxUrl: string | null;
};

type ReplyMention = {
	href: string;
	name: string;
};

const MENTION_PATTERN = /(^|[\s(>])@?([A-Za-z0-9_.-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})(?=$|[\s),.:;!?<])/g;
const PUBLIC_AUDIENCE = 'https://www.w3.org/ns/activitystreams#Public';

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function stripHtmlToText(html: string) {
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

export function escapeHtml(value: string) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function textToParagraphHtml(value: string) {
	const trimmed = String(value || '').trim();

	if (!trimmed) {
		return '';
	}

	return trimmed
		.split(/\n{2,}/)
		.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
		.join('');
}

export async function fetchActivityJson(url: string) {
	const response = await fetch(url, {
		headers: {
			Accept:
				'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams", application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`ActivityPub fetch failed with ${response.status}`);
	}

	return (await response.json()) as Record<string, unknown>;
}

export async function fetchRemoteActor(actorId: string): Promise<RemoteActor> {
	const remoteActor = await fetchActivityJson(actorId);
	const endpoints =
		remoteActor.endpoints && typeof remoteActor.endpoints === 'object'
			? (remoteActor.endpoints as Record<string, unknown>)
			: null;

	return {
		id: actorId,
		name: getString(remoteActor.name),
		handle: getString(remoteActor.preferredUsername),
		inboxUrl: getString(remoteActor.inbox),
		sharedInboxUrl: endpoints ? getString(endpoints.sharedInbox) : null
	};
}

function getMentionHandle(actorId: string, remoteActor: RemoteActor) {
	const handle = String(remoteActor.handle || '').trim().replace(/^@+/, '');
	const host = new URL(actorId).host;
	if (!handle) return `@${host}`;
	return handle.includes('@') ? `@${handle}` : `@${handle}@${host}`;
}

function prependMentionHtml(contentHtml: string, mention: ReplyMention) {
	if (contentHtml.includes(mention.href) || contentHtml.includes(mention.name)) {
		return contentHtml;
	}

	const mentionHtml = `<p><a href="${mention.href}" class="u-url mention">${escapeHtml(mention.name)}</a></p>`;
	return `${mentionHtml}${contentHtml}`;
}

export function normalizeMentionText(value: string) {
	return String(value || '').replace(MENTION_PATTERN, (_match, prefix: string, username: string, domain: string) => {
		return `${prefix}@${username}@${domain}`;
	});
}

async function resolveMentionTagsFromText(contentText: string) {
	const matches = Array.from(normalizeMentionText(contentText).matchAll(MENTION_PATTERN));
	const mentions = new Map<string, ReplyMention>();

	for (const match of matches) {
		const username = match[2];
		const domain = match[3];
		const acct = `${username}@${domain}`;

		try {
			const response = await fetch(`https://${domain}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${acct}`)}`, {
				headers: { Accept: 'application/jrd+json, application/json' }
			});
			if (!response.ok) continue;

			const jrd = (await response.json()) as {
				links?: Array<{ rel?: string; href?: string }>;
			};
			const selfLink = (jrd.links || []).find((link) => link.rel === 'self' && link.href);
			if (!selfLink?.href) continue;

			mentions.set(selfLink.href, {
				href: selfLink.href,
				name: `@${acct}`
			});
		} catch {}
	}

	return Array.from(mentions.values());
}

function buildLocalAudience(
	reply: ApNoteRecord,
	origin: string,
	extraRecipients: string[] = []
) {
	const to = new Set<string>();
	const cc = new Set<string>();
	const followersCollectionId = `${origin}/ap/followers`;

	if (reply.visibility === 'followers') {
		to.add(followersCollectionId);
	} else if (reply.visibility === 'direct' && reply.directRecipientActorId) {
		to.add(reply.directRecipientActorId);
	} else {
		to.add(PUBLIC_AUDIENCE);
		cc.add(followersCollectionId);
	}

	for (const recipient of extraRecipients) {
		const normalized = getString(recipient);
		if (normalized) {
			to.add(normalized);
		}
	}

	return {
		to: Array.from(to),
		cc: Array.from(cc)
	};
}

async function buildMentionedNote(
	reply: ApNoteRecord,
	origin: string,
	input?: { targetActorId?: string | null; targetMention?: ReplyMention | null }
) {
	const detectedMentions = await resolveMentionTagsFromText(reply.contentText || stripHtmlToText(reply.contentHtml));
	const mentions = new Map<string, ReplyMention>();

	for (const mention of detectedMentions) {
		mentions.set(mention.href, mention);
	}

	if (input?.targetActorId && input.targetMention) {
		mentions.set(input.targetActorId, input.targetMention);
	}

	let contentHtml = reply.contentHtml;
	if (input?.targetMention) {
		contentHtml = prependMentionHtml(contentHtml, input.targetMention);
	}

	const audience = buildLocalAudience(
		reply,
		origin,
		Array.from(mentions.values()).map((mention) => mention.href)
	);

	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: reply.noteId,
		type: 'Note',
		attributedTo: getActorId(origin),
		published: reply.publishedAt,
		url: reply.noteId,
		to: audience.to,
		cc: audience.cc,
		inReplyTo: reply.inReplyToObjectId || undefined,
		content: contentHtml,
		contentMap: {
			en: contentHtml
		},
		mediaType: 'text/html',
		tag: Array.from(mentions.values()).map((mention) => ({
			type: 'Mention',
			href: mention.href,
			name: mention.name
		})),
		attachment: reply.attachments.map((item) => ({
			type: 'Image',
			mediaType: item.mediaType,
			url: item.url,
			name: item.alt || undefined
		})),
		source: {
			content: normalizeMentionText(reply.contentText || stripHtmlToText(reply.contentHtml)),
			mediaType: 'text/plain'
		}
	};
}

export async function resolveThreadRootObjectId(
	inReplyToObjectId: string,
	origin: string,
	event?: { platform: App.Platform | undefined }
) {
	let currentId = String(inReplyToObjectId || '').trim();
	let lastKnown = currentId;

	for (let depth = 0; depth < 4; depth += 1) {
		if (!currentId || currentId.startsWith(`${origin}/ap/status/`)) {
			return currentId || lastKnown;
		}

		if (currentId.startsWith(`${origin}/ap/replies/`)) {
			const slug = currentId.slice(`${origin}/ap/replies/`.length);
			if (event?.platform) {
				const note = await getLocalReplyBySlug(event, slug).catch(() => null);
				const nextTarget = note?.threadRootObjectId || note?.inReplyToObjectId;
				if (nextTarget && nextTarget !== currentId) {
					lastKnown = currentId;
					currentId = nextTarget;
					continue;
				}
			}
			return currentId;
		}

		if (currentId.startsWith(`${origin}/ap/notes/`)) {
			const slug = currentId.slice(`${origin}/ap/notes/`.length);
			if (event?.platform) {
				const note = await getLocalReplyBySlug(event, slug).catch(() => null);
				const nextTarget = note?.threadRootObjectId || note?.inReplyToObjectId;
				if (nextTarget && nextTarget !== currentId) {
					lastKnown = currentId;
					currentId = nextTarget;
					continue;
				}
			}
			return currentId;
		}

		try {
			const object = await fetchActivityJson(currentId);
			const parent = getString(object.inReplyTo);
			lastKnown = currentId;

			if (!parent) {
				return currentId;
			}

			currentId = parent;
		} catch {
			return lastKnown;
		}
	}

	return lastKnown;
}

export async function localReplyToNote(reply: ApNoteRecord, origin: string) {
	return buildMentionedNote(reply, origin);
}

export function localReplyToMentionedNote(
	reply: ApNoteRecord,
	origin: string,
	input: {
		targetActorId: string;
		mention: ReplyMention;
	}
) {
	return buildMentionedNote(reply, origin, {
		targetActorId: input.targetActorId,
		targetMention: input.mention
	});
}

export async function localReplyToCreateActivity(reply: ApNoteRecord, origin: string) {
	const noteObject = await localReplyToNote(reply, origin);
	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${reply.noteId}#create`,
		type: 'Create',
		actor: getActorId(origin),
		published: reply.publishedAt,
		to: noteObject.to,
		cc: noteObject.cc,
		object: noteObject
	};
}

export async function localReplyToRemoteCreateActivity(
	reply: ApNoteRecord,
	origin: string,
	inReplyToObjectId: string
) {
	const targetObject = await fetchActivityJson(inReplyToObjectId);
	const targetActorId =
		getString(targetObject.attributedTo) || getString(targetObject.actor);

	if (!targetActorId) {
		throw error(400, 'Target object does not declare an actor');
	}

	const remoteActor = await fetchRemoteActor(targetActorId);
	const mention = {
		href: targetActorId,
		name: getMentionHandle(targetActorId, remoteActor)
	};
	const noteObject = await localReplyToMentionedNote(reply, origin, { targetActorId, mention });

	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${reply.noteId}#create`,
		type: 'Create',
		actor: getActorId(origin),
		published: reply.publishedAt,
		to: noteObject.to,
		cc: noteObject.cc,
		object: noteObject
	};
}

export async function deliverReplyToRemoteActor(origin: string, inReplyToObjectId: string, activity: unknown) {
	const targetObject = await fetchActivityJson(inReplyToObjectId);
	const attributedTo = getString(targetObject.attributedTo) || getString(targetObject.actor);

	if (!attributedTo) {
		throw error(400, 'Target object does not declare an actor');
	}

	const remoteActor = await fetchRemoteActor(attributedTo);
	const targetInbox = remoteActor.sharedInboxUrl || remoteActor.inboxUrl;

	if (!targetInbox) {
		throw error(400, 'Target actor does not expose an inbox');
	}

	await sendSignedActivity(origin, targetInbox, activity);

	return {
		targetActorId: remoteActor.id,
		targetInbox
	};
}

export async function deliverLocalCreateActivity(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	note: ApNoteRecord
) {
	const origin = event.url.origin;
	const activity = await localReplyToCreateActivity(note, origin);

	if (note.visibility === 'direct') {
		const targetActorId = getString(note.directRecipientActorId);
		if (!targetActorId) {
			throw error(400, 'Direct message is missing a recipient actor');
		}

		const remoteActor = await fetchRemoteActor(targetActorId);
		const targetInbox = remoteActor.sharedInboxUrl || remoteActor.inboxUrl;
		if (!targetInbox) {
			throw error(400, 'Target actor does not expose an inbox');
		}

		await sendSignedActivity(origin, targetInbox, activity);
		return;
	}

	const followers = await listFollowers(event);

	for (const follower of followers) {
		const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl;
		if (!inboxUrl) continue;
		await sendSignedActivity(origin, inboxUrl, activity);
	}
}

export function replyJson(body: unknown, init?: ResponseInit) {
	return activityJson(body, init);
}
