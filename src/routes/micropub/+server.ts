import { error } from '@sveltejs/kit';
import { requireMicropubToken } from '$lib/server/indieauth';
import { createLocalNote, createLocalReply, updateLocalReplyDeliveryStatus, type ApNoteRecord } from '$lib/server/ap-notes';
import {
	deliverReplyToRemoteActor,
	localReplyToCreateActivity,
	resolveThreadRootObjectId,
	textToParagraphHtml
} from '$lib/server/activitypub-replies';
import { getActivityPubOrigin } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { listFollowers } from '$lib/server/followers';
import type { RequestEvent } from './$types';

function responseJson(body: unknown, status = 200) {
	return new Response(JSON.stringify(body, null, 2), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'access-control-allow-origin': '*',
			'access-control-allow-headers': 'Authorization, Content-Type',
			'access-control-allow-methods': 'GET, POST, OPTIONS'
		}
	});
}

function getStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((item) => (typeof item === 'string' ? [item.trim()] : [])).filter(Boolean);
	}

	if (typeof value === 'string') {
		return [value.trim()].filter(Boolean);
	}

	return [];
}

async function parseMicropubRequest(request: Request) {
	const contentType = request.headers.get('content-type') || '';

	if (contentType.includes('application/json')) {
		const payload = (await request.json()) as Record<string, unknown>;
		const properties =
			payload.properties && typeof payload.properties === 'object'
				? (payload.properties as Record<string, unknown>)
				: payload;

		return {
			type: typeof payload.type === 'string' ? payload.type : 'entry',
			content: getStringArray(properties.content)[0] || '',
			name: getStringArray(properties.name)[0] || '',
			inReplyTo: getStringArray(properties['in-reply-to'])[0] || '',
			category: getStringArray(properties.category)
		};
	}

	const form = await request.formData();
	return {
		type: String(form.get('h') || form.get('type') || 'entry').trim(),
		content: String(form.get('content') || '').trim(),
		name: String(form.get('name') || '').trim(),
		inReplyTo: String(form.get('in-reply-to') || '').trim(),
		category: form.getAll('category').flatMap((item) => (typeof item === 'string' ? [item.trim()] : [])).filter(Boolean)
	};
}

export async function OPTIONS() {
	return responseJson({});
}

async function deliverLocalNoteToFollowers(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	note: ApNoteRecord
) {
	const origin = getActivityPubOrigin(event);
	const followers = await listFollowers(event);
	const activity = localReplyToCreateActivity(note, origin);

	for (const follower of followers) {
		const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl;
		if (!inboxUrl) continue;
		await sendSignedActivity(origin, inboxUrl, activity);
	}
}

export async function GET(event) {
	await requireMicropubToken(event);
	const query = event.url.searchParams.get('q') || 'config';

	if (query === 'config') {
		return responseJson({
			'media-endpoint': null,
			destination: [event.url.origin]
		});
	}

	return responseJson({});
}

export async function POST(event) {
	await requireMicropubToken(event);
	const input = await parseMicropubRequest(event.request);

	if (input.type !== 'entry') {
		throw error(400, 'Only h=entry posts are supported right now');
	}

	if (!input.content) {
		throw error(400, 'content is required');
	}

	const contentHtml = textToParagraphHtml(input.content);
	const origin = getActivityPubOrigin(event);

	if (input.inReplyTo) {
		const threadRootObjectId = await resolveThreadRootObjectId(input.inReplyTo, origin);
		const reply = await createLocalReply(event, {
			inReplyToObjectId: input.inReplyTo,
			threadRootObjectId,
			contentHtml,
			contentText: input.content
		});

		if (!reply) {
			throw error(500, 'Unable to create local reply');
		}

		try {
			const activity = localReplyToCreateActivity(reply, origin);
			await deliverReplyToRemoteActor(origin, input.inReplyTo, activity);
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', 'delivered');
		} catch (deliveryError) {
			const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
			await updateLocalReplyDeliveryStatus(event, reply.localSlug || '', `failed:${message}`);
			throw deliveryError;
		}

		return new Response(null, {
			status: 201,
			headers: {
				Location: reply.noteId
			}
		});
	}

	const note = await createLocalNote(event, {
		contentHtml,
		contentText: input.content,
		name: input.name || null,
		category: input.category
	});

	if (!note) {
		throw error(500, 'Unable to create local note');
	}

	await deliverLocalNoteToFollowers(event, note);
	await updateLocalReplyDeliveryStatus(event, note.localSlug || '', 'delivered');

	return new Response(null, {
		status: 201,
		headers: {
			Location: note.noteId
		}
	});
}
