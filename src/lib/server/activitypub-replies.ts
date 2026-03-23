import { error } from '@sveltejs/kit';
import { activityJson, getActorId } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import type { ApNoteRecord } from '$lib/server/ap-notes';

type RemoteActor = {
	id: string;
	name: string | null;
	handle: string | null;
	inboxUrl: string | null;
	sharedInboxUrl: string | null;
};

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
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

export async function resolveThreadRootObjectId(inReplyToObjectId: string, origin: string) {
	let currentId = String(inReplyToObjectId || '').trim();
	let lastKnown = currentId;

	for (let depth = 0; depth < 4; depth += 1) {
		if (!currentId || currentId.startsWith(`${origin}/ap/status/`)) {
			return currentId || lastKnown;
		}

		if (currentId.startsWith(`${origin}/ap/replies/`)) {
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
