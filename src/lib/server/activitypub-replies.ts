import { error } from '@sveltejs/kit';
import { activityJson, getActorId } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { getLocalReplyBySlug } from '$lib/server/ap-notes';
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

export function localReplyToNote(reply: ApNoteRecord, origin: string) {
	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: reply.noteId,
		type: 'Note',
		attributedTo: getActorId(origin),
		published: reply.publishedAt,
		url: reply.noteId,
		to: ['https://www.w3.org/ns/activitystreams#Public'],
		cc: [`${origin}/ap/followers`],
		inReplyTo: reply.inReplyToObjectId || undefined,
		content: reply.contentHtml,
		contentMap: {
			en: reply.contentHtml
		},
		mediaType: 'text/html',
		attachment: reply.attachments.map((item) => ({
			type: 'Image',
			mediaType: item.mediaType,
			url: item.url,
			name: item.alt || undefined
		})),
		source: {
			content: reply.contentText || stripHtmlToText(reply.contentHtml),
			mediaType: 'text/plain'
		}
	};
}

export function localReplyToMentionedNote(
	reply: ApNoteRecord,
	origin: string,
	input: {
		targetActorId: string;
		mention: ReplyMention;
	}
) {
	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: reply.noteId,
		type: 'Note',
		attributedTo: getActorId(origin),
		published: reply.publishedAt,
		url: reply.noteId,
		to: ['https://www.w3.org/ns/activitystreams#Public', input.targetActorId],
		cc: [`${origin}/ap/followers`],
		inReplyTo: reply.inReplyToObjectId || undefined,
		content: prependMentionHtml(reply.contentHtml, input.mention),
		contentMap: {
			en: prependMentionHtml(reply.contentHtml, input.mention)
		},
		mediaType: 'text/html',
		tag: [
			{
				type: 'Mention',
				href: input.mention.href,
				name: input.mention.name
			}
		],
		attachment: reply.attachments.map((item) => ({
			type: 'Image',
			mediaType: item.mediaType,
			url: item.url,
			name: item.alt || undefined
		})),
		source: {
			content: `${input.mention.name} ${reply.contentText || stripHtmlToText(reply.contentHtml)}`.trim(),
			mediaType: 'text/plain'
		}
	};
}

export function localReplyToCreateActivity(reply: ApNoteRecord, origin: string) {
	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${reply.noteId}#create`,
		type: 'Create',
		actor: getActorId(origin),
		published: reply.publishedAt,
		to: ['https://www.w3.org/ns/activitystreams#Public'],
		cc: [`${origin}/ap/followers`],
		object: localReplyToNote(reply, origin)
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

	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${reply.noteId}#create`,
		type: 'Create',
		actor: getActorId(origin),
		published: reply.publishedAt,
		to: ['https://www.w3.org/ns/activitystreams#Public', targetActorId],
		cc: [`${origin}/ap/followers`],
		object: localReplyToMentionedNote(reply, origin, { targetActorId, mention })
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

export function replyJson(body: unknown, init?: ResponseInit) {
	return activityJson(body, init);
}
