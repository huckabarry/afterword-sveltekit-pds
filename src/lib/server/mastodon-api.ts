import { getActivityPubHandle, getActivityPubOrigin, getActorId } from '$lib/server/activitypub';
import {
	getNoteById,
	listDirectRepliesToObject,
	listLocalNotes,
	listNotesForThread,
	type ApNoteRecord,
	type LocalApNoteListItem
} from '$lib/server/ap-notes';
import { listFollowers } from '$lib/server/followers';
import { getSiteProfile } from '$lib/server/profile';
import { fetchActivityJson, fetchRemoteActor, stripHtmlToText } from '$lib/server/activitypub-replies';
import { getStatusBySlug, getStatuses, type StatusPost } from '$lib/server/atproto';
import { getFollowingByActorId, listFollowing } from '$lib/server/activitypub-follows';
import { isObjectFavourited } from '$lib/server/mastodon-state';
import type { RequestEvent } from '@sveltejs/kit';

function base64UrlEncode(value: string) {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(value, 'utf8').toString('base64url');
	}

	return btoa(unescape(encodeURIComponent(value)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(value, 'base64url').toString('utf8');
	}

	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	return decodeURIComponent(escape(atob(normalized)));
}

export function encodeMastodonStatusId(value: string) {
	return base64UrlEncode(`status:${value}`);
}

export function decodeMastodonStatusId(value: string) {
	const decoded = base64UrlDecode(value);
	return decoded.startsWith('status:') ? decoded.slice(7) : null;
}

export function encodeMastodonAccountId(value: string) {
	return base64UrlEncode(`account:${value}`);
}

export function decodeMastodonAccountId(value: string) {
	const decoded = base64UrlDecode(value);
	return decoded.startsWith('account:') ? decoded.slice(8) : null;
}

export function encodeMastodonMediaId(value: string) {
	return base64UrlEncode(`media:${value}`);
}

export function decodeMastodonMediaId(value: string) {
	const decoded = base64UrlDecode(value);
	return decoded.startsWith('media:') ? decoded.slice(6) : null;
}

function normalizeUrl(origin: string, value: string | null | undefined) {
	const trimmed = String(value || '').trim();
	if (!trimmed) return null;
	return trimmed.startsWith('http') ? trimmed : `${origin}${trimmed}`;
}

function toExcerpt(htmlOrText: string) {
	return String(htmlOrText || '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function isoDate(value: string | Date) {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function buildLocalAccount(event: Pick<RequestEvent, 'platform' | 'url'>) {
	const origin = getActivityPubOrigin(event);
	const profile = await getSiteProfile(event);
	const followers = await listFollowers(event);
	const notes = await listLocalNotes(event, 500);
	const handle = getActivityPubHandle(origin);
	const username = handle.startsWith('@') ? handle.slice(1).split('@')[0] : handle;
	const avatar = normalizeUrl(origin, profile.avatarUrl) || `${origin}/assets/images/status-avatar.jpg`;
	const header = normalizeUrl(origin, profile.headerImageUrl) || avatar;

	return {
		id: encodeMastodonAccountId(getActorId(origin)),
		username,
		acct: username,
		display_name: profile.displayName,
		note: profile.bio,
		url: `${origin}/`,
		uri: getActorId(origin),
		avatar,
		avatar_static: avatar,
		header,
		header_static: header,
		locked: false,
		bot: false,
		discoverable: true,
		group: false,
		created_at: '2026-01-01T00:00:00.000Z',
		followers_count: followers.length,
		following_count: (await listFollowing(event)).length,
		statuses_count: notes.length,
		emojis: [],
		fields: profile.verificationLinks.map((link) => ({
			name: link.label,
			value: `<a href="${link.url}" rel="me nofollow noopener noreferrer" target="_blank">${link.url}</a>`,
			verified_at: null
		})),
		source: {
			note: profile.bio,
			fields: profile.verificationLinks.map((link) => ({
				name: link.label,
				value: link.url
			})),
			privacy: 'public',
			sensitive: false,
			language: 'en'
		}
	};
}

export async function buildRemoteAccount(event: Pick<RequestEvent, 'platform' | 'url'>, actorId: string) {
	const origin = getActivityPubOrigin(event);
	const actor = await fetchActivityJson(actorId);
	const actorMeta = await fetchRemoteActor(actorId);
	const icon =
		actor.icon && typeof actor.icon === 'object' ? (actor.icon as Record<string, unknown>) : null;
	const image =
		actor.image && typeof actor.image === 'object' ? (actor.image as Record<string, unknown>) : null;
	const actorUrl = (typeof actor.url === 'string' && actor.url.trim()) || actorId;
	const followers = await listFollowers(event);
	const following = await getFollowingByActorId(event, actorId);
	const username = actorMeta.handle || String(actor.preferredUsername || '').trim() || actorId;

	return {
		id: encodeMastodonAccountId(actorId),
		username,
		acct: username.includes('@') ? username : `${username}@${new URL(actorId).host}`,
		display_name: actorMeta.name || username,
		note: String(actor.summary || ''),
		url: actorUrl,
		uri: actorId,
		avatar: (typeof icon?.url === 'string' && icon.url.trim()) || `${origin}/assets/images/status-avatar.jpg`,
		avatar_static:
			(typeof icon?.url === 'string' && icon.url.trim()) || `${origin}/assets/images/status-avatar.jpg`,
		header:
			(typeof image?.url === 'string' && image.url.trim()) ||
			((typeof icon?.url === 'string' && icon.url.trim()) || `${origin}/assets/images/status-avatar.jpg`),
		header_static:
			(typeof image?.url === 'string' && image.url.trim()) ||
			((typeof icon?.url === 'string' && icon.url.trim()) || `${origin}/assets/images/status-avatar.jpg`),
		locked: false,
		bot: false,
		discoverable: true,
		group: false,
		created_at: '2026-01-01T00:00:00.000Z',
		followers_count: followers.filter((item) => item.actorId === actorId).length,
		following_count: 0,
		statuses_count: 0,
		emojis: [],
		fields: [],
		source: {
			note: stripHtmlToText(String(actor.summary || '')),
			fields: [],
			privacy: 'public',
			sensitive: false,
			language: 'en'
		},
		_afterwordRelationship: {
			following: Boolean(following),
			followedBy: followers.some((item) => item.actorId === actorId)
		}
	};
}

function serializeMediaAttachments(attachments: Array<{ url: string; mediaType: string; alt: string }>) {
	return attachments.map((attachment) => ({
		id: encodeMastodonMediaId(attachment.url),
		type: attachment.mediaType.startsWith('video/') ? 'video' : 'image',
		url: attachment.url,
		preview_url: attachment.url,
		remote_url: null,
		meta: null,
		description: attachment.alt || null,
		blurhash: null
	}));
}

function serializeCard(status: StatusPost) {
	if (!status.external) return null;

	return {
		url: status.external.uri,
		title: status.external.title,
		description: status.external.description,
		type: 'link',
		author_name: '',
		author_url: '',
		provider_name: status.external.domain,
		provider_url: `https://${status.external.domain}`,
		html: '',
		width: 0,
		height: 0,
		image: null,
		embed_url: ''
	};
}

export async function serializeLocalNoteStatus(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	note: LocalApNoteListItem
) {
	const account = await buildLocalAccount(event);
	const favourited = await isObjectFavourited(event, note.noteId);

	return {
		id: encodeMastodonStatusId(note.noteId),
		created_at: isoDate(note.publishedAt),
		in_reply_to_id: note.inReplyToObjectId ? encodeMastodonStatusId(note.inReplyToObjectId) : null,
		in_reply_to_account_id: null,
		sensitive: false,
		spoiler_text: '',
		visibility: 'public',
		language: 'en',
		uri: note.noteId,
		url: note.objectUrl || note.noteId,
		replies_count: note.incomingReplyCount,
		reblogs_count: 0,
		favourites_count: favourited ? 1 : 0,
		favourited,
		reblogged: false,
		bookmarked: false,
		content: note.contentHtml,
		reblog: null,
		application: {
			name: 'Afterword',
			website: `${event.url.origin}/`
		},
		account,
		media_attachments: serializeMediaAttachments(note.attachments),
		mentions: [],
		tags: [],
		emojis: [],
		card: null,
		poll: null
	};
}

export async function serializeMirroredStatus(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	status: StatusPost
) {
	const account = await buildLocalAccount(event);
	const origin = getActivityPubOrigin(event);
	const objectId = `${origin}/ap/status/${status.slug}`;
	const favourited = await isObjectFavourited(event, objectId);
	const mediaAttachments = status.images.map((image) => ({
		id: encodeMastodonMediaId(image.fullsize),
		type: 'image',
		url: image.fullsize,
		preview_url: image.thumb,
		remote_url: image.fullsize,
		meta: null,
		description: image.alt || null,
		blurhash: null
	}));

	return {
		id: encodeMastodonStatusId(objectId),
		created_at: isoDate(status.date),
		in_reply_to_id: status.replyTo?.uri ? encodeMastodonStatusId(status.replyTo.uri) : null,
		in_reply_to_account_id: null,
		sensitive: false,
		spoiler_text: '',
		visibility: 'public',
		language: 'en',
		uri: objectId,
		url: `${origin}/status/${status.slug}`,
		replies_count: status.replyCount,
		reblogs_count: status.repostCount,
		favourites_count: status.likeCount + (favourited ? 1 : 0),
		favourited,
		reblogged: false,
		bookmarked: false,
		content: status.html,
		reblog: null,
		application: {
			name: 'Bluesky mirror',
			website: status.blueskyUrl
		},
		account,
		media_attachments: mediaAttachments,
		mentions: [],
		tags: [],
		emojis: [],
		card: serializeCard(status),
		poll: null
	};
}

export async function buildHomeTimeline(event: Pick<RequestEvent, 'platform' | 'url'>, limit = 40) {
	const [localNotes, mirroredStatuses] = await Promise.all([
		listLocalNotes(event, limit),
		getStatuses()
	]);

	const localStatuses = await Promise.all(localNotes.map((note) => serializeLocalNoteStatus(event, note)));
	const mirrored = await Promise.all(
		mirroredStatuses.slice(0, limit).map((status) => serializeMirroredStatus(event, status))
	);

	return [...localStatuses, ...mirrored]
		.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
		.slice(0, limit);
}

export async function resolveStatusByObjectId(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	objectId: string
) {
	const origin = getActivityPubOrigin(event);

	if (objectId.startsWith(`${origin}/ap/status/`)) {
		const slug = objectId.slice(`${origin}/ap/status/`.length);
		const status = await getStatusBySlug(slug);
		return status ? await serializeMirroredStatus(event, status) : null;
	}

	const note = await getNoteById(event, objectId);
	if (note?.origin === 'local') {
		const localNotes = await listLocalNotes(event, 500);
		const listItem =
			localNotes.find((item) => item.noteId === note.noteId) || ({ ...note, incomingReplyCount: 0 } as LocalApNoteListItem);
		return await serializeLocalNoteStatus(event, listItem);
	}

	return null;
}

async function serializeReplyNote(event: Pick<RequestEvent, 'platform' | 'url'>, note: ApNoteRecord) {
	if (note.origin === 'local') {
		return serializeLocalNoteStatus(event, { ...note, incomingReplyCount: 0 });
	}

	const origin = getActivityPubOrigin(event);
	const profile = await buildRemoteAccount(event, note.actorId);
	const favourited = await isObjectFavourited(event, note.noteId);

	return {
		id: encodeMastodonStatusId(note.noteId),
		created_at: isoDate(note.publishedAt),
		in_reply_to_id: note.inReplyToObjectId ? encodeMastodonStatusId(note.inReplyToObjectId) : null,
		in_reply_to_account_id: encodeMastodonAccountId(note.actorId),
		sensitive: false,
		spoiler_text: '',
		visibility: 'public',
		language: 'en',
		uri: note.noteId,
		url: note.objectUrl || note.noteId,
		replies_count: 0,
		reblogs_count: 0,
		favourites_count: favourited ? 1 : 0,
		favourited,
		reblogged: false,
		bookmarked: false,
		content: note.contentHtml || textToHtmlFallback(note.contentText),
		reblog: null,
		application: {
			name: 'ActivityPub',
			website: note.objectUrl || note.noteId
		},
		account: profile,
		media_attachments: serializeMediaAttachments(note.attachments),
		mentions: [],
		tags: [],
		emojis: [],
		card: null,
		poll: null
	};
}

function textToHtmlFallback(value: string) {
	return String(value || '')
		.trim()
		.split(/\n{2,}/)
		.map((paragraph) => `<p>${paragraph}</p>`)
		.join('');
}

export async function buildStatusContext(event: Pick<RequestEvent, 'platform' | 'url'>, objectId: string) {
	const note = await getNoteById(event, objectId);
	const rootObjectId = note?.threadRootObjectId || objectId;
	const threadNotes = await listNotesForThread(event, rootObjectId);
	const descendants = threadNotes.filter((item) => item.noteId !== rootObjectId);

	return {
		ancestors: [] as unknown[],
		descendants: await Promise.all(descendants.map((item) => serializeReplyNote(event, item)))
	};
}

export async function resolveAccountByIdOrAcct(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	value: string
) {
	const origin = getActivityPubOrigin(event);
	const localActorId = getActorId(origin);
	if (value === localActorId || value === encodeMastodonAccountId(localActorId) || value === getActivityPubHandle(origin)) {
		return buildLocalAccount(event);
	}

	let actorId = value;
	const decoded = value.includes(':') ? null : decodeMastodonAccountId(value);
	if (decoded) actorId = decoded;

	if (!actorId.startsWith('http')) {
		const acct = value.startsWith('@') ? value.slice(1) : value;
		const resource = `acct:${acct}`;
		const [, domain] = acct.split('@');
		if (!domain) {
			throw new Error('Account lookup requires a full acct handle');
		}
		const response = await fetch(`https://${domain}/.well-known/webfinger?resource=${encodeURIComponent(resource)}`, {
			headers: { Accept: 'application/jrd+json, application/json' }
		});
		if (!response.ok) {
			throw new Error('Unable to resolve account');
		}
		const jrd = (await response.json()) as { links?: Array<{ rel?: string; href?: string; type?: string }> };
		const selfLink = (jrd.links || []).find((link) => link.rel === 'self' && link.href);
		if (!selfLink?.href) {
			throw new Error('WebFinger did not return an actor');
		}
		actorId = selfLink.href;
	}

	return buildRemoteAccount(event, actorId);
}

export function buildRelationship(accountId: string, input: { following: boolean; followedBy: boolean }) {
	return {
		id: accountId,
		following: input.following,
		showing_reblogs: true,
		followed_by: input.followedBy,
		blocking: false,
		blocked_by: false,
		muting: false,
		muting_notifications: false,
		requested: false,
		domain_blocking: false,
		endorsed: false,
		note: '',
		notifying: false
	};
}

export function parseMastodonBody(request: Request) {
	const contentType = request.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		return request.json().catch(() => ({}));
	}
	return request.formData().catch(() => new FormData());
}
