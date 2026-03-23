import { getActivityPubHandle, getActivityPubOrigin, getActorId } from '$lib/server/activitypub';
import { listLocalNotes, type LocalApNoteListItem } from '$lib/server/ap-notes';
import { listFollowers } from '$lib/server/followers';
import { getSiteProfile } from '$lib/server/profile';
import { getStatuses, type StatusPost } from '$lib/server/atproto';
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
		id: encodeMastodonStatusId(getActorId(origin)),
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
		following_count: 0,
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
		favourites_count: 0,
		favourited: false,
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
		id: encodeMastodonStatusId(`${origin}/ap/status/${status.slug}`),
		created_at: isoDate(status.date),
		in_reply_to_id: status.replyTo?.uri ? encodeMastodonStatusId(status.replyTo.uri) : null,
		in_reply_to_account_id: null,
		sensitive: false,
		spoiler_text: '',
		visibility: 'public',
		language: 'en',
		uri: `${origin}/ap/status/${status.slug}`,
		url: `${origin}/status/${status.slug}`,
		replies_count: status.replyCount,
		reblogs_count: status.repostCount,
		favourites_count: status.likeCount,
		favourited: false,
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

export function parseMastodonBody(request: Request) {
	const contentType = request.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		return request.json().catch(() => ({}));
	}
	return request.formData().catch(() => new FormData());
}
