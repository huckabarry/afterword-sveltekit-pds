import { json } from '@sveltejs/kit';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import {
	createLocalNote,
	createLocalReply,
	getLocalReplyBySlug,
	listLocalNotes,
	normalizeApNoteVisibility,
	updateLocalReplyDeliveryStatus
} from '$lib/server/ap-notes';
import {
	buildHomeTimeline,
	decodeMastodonMediaId,
	decodeMastodonStatusId,
	serializeLocalNoteStatus
} from '$lib/server/mastodon-api';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import {
	deliverLocalCreateActivity,
	deliverReplyToRemoteActor,
	localReplyToRemoteCreateActivity,
	normalizeMentionText,
	resolveThreadRootObjectId,
	textToParagraphHtml
} from '$lib/server/activitypub-replies';
import { uploadRemoteImageUrls } from '$lib/server/media';

function isLocalReplyTarget(origin: string, objectId: string) {
	return String(objectId || '').startsWith(`${origin}/ap/`);
}

function readEntries(source: FormData | Record<string, unknown>, key: string) {
	if (source instanceof FormData) {
		return source.getAll(key).map((value) => String(value || '').trim()).filter(Boolean);
	}
	const value = source[key];
	if (Array.isArray(value)) {
		return value.map((item) => String(item || '').trim()).filter(Boolean);
	}
	if (typeof value === 'string' && value.trim()) {
		return [value.trim()];
	}
	return [];
}

function extractUrls(content: string) {
	return String(content || '').match(/https?:\/\/\S+/g) || [];
}

export async function GET(event) {
	await requireMastodonAccessToken(event);
	const limit = Math.max(1, Math.min(Number.parseInt(event.url.searchParams.get('limit') || '20', 10) || 20, 40));
	return json(await buildHomeTimeline(event, limit));
}

export async function POST(event) {
	await requireMastodonAccessToken(event);

	const parsed = await (async () => {
		const contentType = event.request.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			return (await event.request.json().catch(() => ({}))) as Record<string, unknown>;
		}
		return await event.request.formData().catch(() => new FormData());
	})();

	const getValue = (key: string) =>
		parsed instanceof FormData ? String(parsed.get(key) || '').trim() : String(parsed[key] || '').trim();

	const originalContent = normalizeMentionText(getValue('status'));
	const inReplyToId = getValue('in_reply_to_id');
	const requestedVisibility = getValue('visibility');
	const visibility = normalizeApNoteVisibility(
		requestedVisibility === 'private' ? 'followers' : requestedVisibility
	);
	const directTo = getValue('direct_to');
	const mediaIds = [...readEntries(parsed, 'media_ids[]'), ...readEntries(parsed, 'media_ids')];
	const candidateUrls = extractUrls(originalContent);
	const importedAttachments = await uploadRemoteImageUrls(event, candidateUrls, {
		scope: 'ap-notes',
		prefix: 'mastodon-share'
	});
	const importedSourceUrls = new Set(
		importedAttachments.map((item) => String(item.sourceUrl || '').trim()).filter(Boolean)
	);
	const content = normalizeMentionText(
		originalContent
			.replace(/https?:\/\/\S+/g, (match) => (importedSourceUrls.has(match) ? '' : match))
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	);
	const hasMedia = mediaIds.length > 0 || importedAttachments.length > 0;

	if (!content && !hasMedia) {
		return json({ error: 'status is required' }, { status: 422 });
	}

	if (!inReplyToId && visibility === 'direct' && !directTo) {
		return json({ error: 'direct_to is required for direct messages' }, { status: 422 });
	}

	const attachments = [
		...mediaIds
			.map((item) => decodeMastodonMediaId(item))
			.filter((item): item is string => Boolean(item))
			.map((key) => ({
				url: `${event.url.origin}/media/${key}`,
				mediaType: 'image/jpeg',
				alt: ''
			})),
		...importedAttachments
	];

	const origin = getActivityPubOrigin(event);
	const contentHtml = content ? textToParagraphHtml(content) : '<p></p>';

	if (inReplyToId) {
		const replyTo = decodeMastodonStatusId(inReplyToId);
		if (!replyTo) {
			return json({ error: 'Unknown reply target' }, { status: 404 });
		}

		const threadRootObjectId = await resolveThreadRootObjectId(replyTo, origin, event);
		const reply = await createLocalReply(event, {
			inReplyToObjectId: replyTo,
			threadRootObjectId,
			contentHtml,
			contentText: content,
			attachments
		});

		if (!reply) {
			return json({ error: 'Unable to create reply.' }, { status: 500 });
		}

		try {
			if (isLocalReplyTarget(origin, replyTo)) {
				await deliverLocalCreateActivity(event, reply);
			} else {
				const remoteActivity = await localReplyToRemoteCreateActivity(reply, origin, replyTo);
				await deliverReplyToRemoteActor(origin, replyTo, remoteActivity);
			}
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', 'delivered');
		} catch (deliveryError) {
			const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', `failed:${message}`);
			return json({ error: message || 'Unable to deliver reply.' }, { status: 500 });
		}

		const note = await getLocalReplyBySlug(event, reply.localSlug || '');
		if (!note) {
			return json({ error: 'Unable to reload reply.' }, { status: 500 });
		}

		const localNotes = await listLocalNotes(event, 500);
		const listItem = localNotes.find((item) => item.noteId === note.noteId);
		return json(await serializeLocalNoteStatus(event, listItem || { ...note, incomingReplyCount: 0 }));
	}

	const note = await createLocalNote(event, {
		contentHtml,
		contentText: content,
		visibility,
		directRecipientActorId: visibility === 'direct' ? directTo : null,
		attachments
	});

	if (!note) {
		return json({ error: 'Unable to create note.' }, { status: 500 });
	}

	try {
		await deliverLocalCreateActivity(event, note);
		await updateLocalReplyDeliveryStatus(event, note.localSlug || '', 'delivered');
	} catch (deliveryError) {
		const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
		await updateLocalReplyDeliveryStatus(event, note.localSlug || '', `failed:${message}`);
		return json({ error: message || 'Unable to deliver note.' }, { status: 500 });
	}

	const localNotes = await listLocalNotes(event, 500);
	const listItem = localNotes.find((item) => item.noteId === note.noteId);
	return json(await serializeLocalNoteStatus(event, listItem || { ...note, incomingReplyCount: 0 }));
}
