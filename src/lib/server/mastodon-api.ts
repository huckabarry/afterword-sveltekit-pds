import { getActivityPubHandle, getActivityPubOrigin, getActorId } from '$lib/server/activitypub';
import {
	getNoteById,
	listDirectRepliesToObject,
	listLocalNotes,
	listRecentInboxReplies,
	listNotesForThread,
	type ApNoteRecord,
	type LocalApNoteListItem
} from '$lib/server/ap-notes';
import { listFollowers } from '$lib/server/followers';
import { getSiteProfile } from '$lib/server/profile';
import { fetchActivityJson, fetchRemoteActor, stripHtmlToText } from '$lib/server/activitypub-replies';
import { getStatusBySlug, getStatuses, type StatusPost } from '$lib/server/atproto';
import { getFollowingByActorId, listFollowing } from '$lib/server/activitypub-follows';
import {
	isActorBlocked,
	isActorMuted,
	isObjectBookmarked,
	isObjectFavourited,
	isObjectReblogged,
	isStatusMuted,
	isStatusPinned
} from '$lib/server/mastodon-state';
import {
	getCachedRemoteStatus,
	listCachedRemoteStatusesForActor,
	listCachedRemoteStatusesForActors,
	syncRemoteStatusesForActor,
	type CachedRemoteStatus
} from '$lib/server/mastodon-remote-statuses';
import type { RequestEvent } from '@sveltejs/kit';
import sharp from 'sharp';

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

export function encodeMastodonStatusId(value: string, sortableDate?: string | Date | null) {
	const encoded = base64UrlEncode(`status:${value}`);
	if (!sortableDate) return encoded;

	const timestamp = sortableDate instanceof Date ? sortableDate.getTime() : Date.parse(String(sortableDate));
	if (!Number.isFinite(timestamp)) return encoded;

	return `z${String(Math.max(0, Math.floor(timestamp))).padStart(13, '0')}-${encoded}`;
}

export function decodeMastodonStatusId(value: string) {
	const encoded = value.includes('-') ? value.slice(value.indexOf('-') + 1) : value;
	const decoded = base64UrlDecode(encoded);
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

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getActorIdFromObject(object: Record<string, unknown>) {
	const attributedTo = object.attributedTo;
	if (typeof attributedTo === 'string' && attributedTo.trim()) return attributedTo.trim();
	if (Array.isArray(attributedTo)) {
		const first = attributedTo.find((item) => typeof item === 'string' && item.trim());
		if (typeof first === 'string') return first.trim();
	}
	return null;
}

export async function buildLocalAccount(event: Pick<RequestEvent, 'platform' | 'url'>) {
	const origin = getActivityPubOrigin(event);
	const profile = await getSiteProfile(event);
	const followers = await listFollowers(event);
	const notes = await listLocalNotes(event, 500);
	const handle = getActivityPubHandle(origin);
	const normalizedHandle = handle.startsWith('@') ? handle.slice(1) : handle;
	const username = normalizedHandle.split('@')[0] || normalizedHandle;
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
	let statusesCount = 0;
	let lastStatusAt: string | null = null;

	try {
		const outboxUrl = getString(actor.outbox);
		if (outboxUrl) {
			const outbox = await fetchActivityJson(outboxUrl);
			statusesCount = Number(outbox.totalItems || 0);
			const orderedItems = await expandOrderedItems(outbox);

			for (const item of orderedItems) {
				let record: Record<string, unknown> | null = null;
				if (typeof item === 'string') {
					record = await fetchActivityJson(item).catch(() => null);
				} else if (item && typeof item === 'object') {
					record = item as Record<string, unknown>;
				}
				if (!record) continue;

				const type = String(record.type || '');
				let object = record;
				if (type === 'Create') {
					const activityObject = record.object;
					if (typeof activityObject === 'string') {
						object = (await fetchActivityJson(activityObject).catch(() => null)) || {};
					} else if (activityObject && typeof activityObject === 'object') {
						object = activityObject as Record<string, unknown>;
					}
				}

				lastStatusAt = getString(object.published) || getString(object.updated);
				if (lastStatusAt) break;
			}
		}
	} catch {}

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
		statuses_count: statusesCount,
		last_status_at: lastStatusAt ? lastStatusAt.slice(0, 10) : null,
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
	return Promise.all(attachments.map((attachment) => serializeMediaAttachment(attachment)));
}

type MediaAttachmentInput = {
	url: string;
	mediaType: string;
	alt: string;
	previewUrl?: string | null;
	remoteUrl?: string | null;
};

type MediaAttachmentMeta = {
	original: {
		width: number;
		height: number;
		size: string;
		aspect: number;
	};
	small: {
		width: number;
		height: number;
		size: string;
		aspect: number;
	};
	focus: {
		x: number;
		y: number;
	};
};

function getMediaMetaCache() {
	const scope = globalThis as typeof globalThis & {
		__afterwordMediaMetaCache?: Map<string, MediaAttachmentMeta | null>;
	};
	if (!scope.__afterwordMediaMetaCache) {
		scope.__afterwordMediaMetaCache = new Map<string, MediaAttachmentMeta | null>();
	}
	return scope.__afterwordMediaMetaCache;
}

async function getImageMeta(url: string): Promise<MediaAttachmentMeta | null> {
	if (!url) return null;
	const mediaMetaCache = getMediaMetaCache();
	if (mediaMetaCache.has(url)) {
		return mediaMetaCache.get(url) ?? null;
	}

	try {
		const response = await fetch(url, {
			headers: { Accept: 'image/*,*/*;q=0.8' }
		});
		if (!response.ok) {
			mediaMetaCache.set(url, null);
			return null;
		}

		const bytes = new Uint8Array(await response.arrayBuffer());
		const metadata = await sharp(bytes).metadata();
		const width = Number(metadata.width || 0);
		const height = Number(metadata.height || 0);
		if (!width || !height) {
			mediaMetaCache.set(url, null);
			return null;
		}

		const aspect = width / height;
		const meta = {
			original: {
				width,
				height,
				size: `${width}x${height}`,
				aspect
			},
			small: {
				width,
				height,
				size: `${width}x${height}`,
				aspect
			},
			focus: {
				x: 0,
				y: 0
			}
		} satisfies MediaAttachmentMeta;

		mediaMetaCache.set(url, meta);
		return meta;
	} catch {
		mediaMetaCache.set(url, null);
		return null;
	}
}

async function serializeMediaAttachment(input: MediaAttachmentInput) {
	const meta = input.mediaType.startsWith('image/') ? await getImageMeta(input.previewUrl || input.url) : null;

	return {
		id: encodeMastodonMediaId(input.url),
		type: input.mediaType.startsWith('video/') ? 'video' : 'image',
		url: input.url,
		preview_url: input.previewUrl || input.url,
		remote_url: input.remoteUrl ?? null,
		meta,
		description: input.alt || null,
		blurhash: null
	};
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
	const bookmarked = await isObjectBookmarked(event, note.noteId);
	const reblogged = await isObjectReblogged(event, note.noteId);
	const muted = await isStatusMuted(event, note.noteId);
	const pinned = await isStatusPinned(event, note.noteId);

	return {
		id: encodeMastodonStatusId(note.noteId, note.publishedAt),
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
		reblogs_count: reblogged ? 1 : 0,
		favourites_count: favourited ? 1 : 0,
		favourited,
		reblogged,
		muted,
		bookmarked,
		pinned,
		content: note.contentHtml,
		text: note.contentText || stripHtmlToText(note.contentHtml || ''),
		reblog: null,
		application: {
			name: 'Afterword',
			website: `${event.url.origin}/`
		},
		account,
		media_attachments: await serializeMediaAttachments(note.attachments),
		mentions: [],
		tags: [],
		emojis: [],
		card: null,
		poll: null,
		filtered: [],
		edited_at: null
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
	const bookmarked = await isObjectBookmarked(event, objectId);
	const reblogged = await isObjectReblogged(event, objectId);
	const muted = await isStatusMuted(event, objectId);
	const pinned = await isStatusPinned(event, objectId);
	const mediaAttachments = status.images.map((image) => ({
		url: image.fullsize,
		mediaType: 'image/jpeg',
		alt: image.alt || '',
		previewUrl: image.thumb,
		remoteUrl: image.fullsize
	}));

	return {
		id: encodeMastodonStatusId(objectId, status.date),
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
		reblogs_count: status.repostCount + (reblogged ? 1 : 0),
		favourites_count: status.likeCount + (favourited ? 1 : 0),
		favourited,
		reblogged,
		muted,
		bookmarked,
		pinned,
		content: status.html,
		text: status.text,
		reblog: null,
		application: {
			name: 'Bluesky mirror',
			website: status.blueskyUrl
		},
		account,
		media_attachments: await Promise.all(mediaAttachments.map((item) => serializeMediaAttachment(item))),
		mentions: [],
		tags: [],
		emojis: [],
		card: serializeCard(status),
		poll: null,
		filtered: [],
		edited_at: null
	};
}

function serializeRemoteObjectAttachments(attachment: unknown): MediaAttachmentInput[] {
	const items = Array.isArray(attachment) ? attachment : attachment ? [attachment] : [];
	const attachments: MediaAttachmentInput[] = [];

	for (const item of items) {
		if (!item || typeof item !== 'object') continue;
		const record = item as Record<string, unknown>;
		const url = getString(record.url);
		if (!url) continue;
		const mediaType = getString(record.mediaType) || 'image/jpeg';
		attachments.push({
			url,
			mediaType,
			alt: getString(record.name) || '',
			previewUrl: url,
			remoteUrl: url
		});
	}

	return attachments;
}

async function serializeRemoteObjectStatus(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	actorId: string,
	object: Record<string, unknown>
) {
	const objectId = getString(object.id) || getString(object.url);
	if (!objectId) return null;

	const account = await buildRemoteAccount(event, actorId);
	const favourited = await isObjectFavourited(event, objectId);
	const bookmarked = await isObjectBookmarked(event, objectId);
	const reblogged = await isObjectReblogged(event, objectId);
	const tags = Array.isArray(object.tag) ? object.tag : [];
	const mentions = tags
		.map((item) => {
			if (!item || typeof item !== 'object') return null;
			const record = item as Record<string, unknown>;
			if (String(record.type || '') !== 'Mention') return null;
			const url = getString(record.href);
			const name = getString(record.name);
			if (!url || !name) return null;
			const acct = name.replace(/^@/, '');
			return {
				id: encodeMastodonAccountId(url),
				username: acct.split('@')[0] || acct,
				url,
				acct
			};
		})
		.filter(Boolean);

	return {
		id: encodeMastodonStatusId(
			objectId,
			getString(object.published) || getString(object.updated) || new Date().toISOString()
		),
		created_at: isoDate(getString(object.published) || getString(object.updated) || new Date().toISOString()),
		in_reply_to_id: getString(object.inReplyTo) ? encodeMastodonStatusId(String(object.inReplyTo)) : null,
		in_reply_to_account_id: null,
		sensitive: false,
		spoiler_text: '',
		visibility: 'public',
		language: 'en',
		uri: objectId,
		url: getString(object.url) || objectId,
		replies_count: 0,
		reblogs_count: reblogged ? 1 : 0,
		favourites_count: favourited ? 1 : 0,
		favourited,
		reblogged,
		bookmarked,
		content: getString(object.content) || `<p>${toExcerpt(getString(object.summary) || '')}</p>`,
		reblog: null,
		application: {
			name: 'ActivityPub',
			website: getString(object.url) || objectId
		},
		account,
		media_attachments: await Promise.all(
			serializeRemoteObjectAttachments(object.attachment).map((item) => serializeMediaAttachment(item))
		),
		mentions,
		tags: [],
		emojis: [],
		card: null,
		poll: null
	};
}

function buildRemoteAccountFromCachedStatus(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	status: CachedRemoteStatus
) {
	const origin = getActivityPubOrigin(event);
	const acct =
		status.actorHandle?.replace(/^@+/, '') || `${new URL(status.actorId).pathname.split('/').pop() || 'remote'}@${new URL(status.actorId).host}`;
	const username = acct.split('@')[0] || acct;
	const avatar = status.actorAvatarUrl || `${origin}/assets/images/status-avatar.jpg`;
	const header = status.actorHeaderUrl || avatar;

	return {
		id: encodeMastodonAccountId(status.actorId),
		username,
		acct,
		display_name: status.actorName || username,
		note: status.actorSummary || '',
		url: status.actorUrl || status.actorId,
		uri: status.actorId,
		avatar,
		avatar_static: avatar,
		header,
		header_static: header,
		locked: false,
		bot: false,
		discoverable: true,
		group: false,
		created_at: '2026-01-01T00:00:00.000Z',
		followers_count: 0,
		following_count: 0,
		statuses_count: 0,
		last_status_at: status.publishedAt ? status.publishedAt.slice(0, 10) : null,
		emojis: [],
		fields: [],
		source: {
			note: status.actorSummary || '',
			fields: [],
			privacy: 'public',
			sensitive: false,
			language: 'en'
		}
	};
}

async function serializeCachedRemoteStatus(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	status: CachedRemoteStatus
) {
	const favourited = await isObjectFavourited(event, status.objectId);
	const bookmarked = await isObjectBookmarked(event, status.objectId);
	const reblogged = await isObjectReblogged(event, status.objectId);
	const muted = await isStatusMuted(event, status.objectId);
	const pinned = await isStatusPinned(event, status.objectId);

	return {
		id: encodeMastodonStatusId(status.objectId, status.publishedAt),
		created_at: isoDate(status.publishedAt),
		in_reply_to_id: status.inReplyToObjectId ? encodeMastodonStatusId(status.inReplyToObjectId) : null,
		in_reply_to_account_id: null,
		sensitive: false,
		spoiler_text: '',
		visibility: 'public',
		language: 'en',
		uri: status.objectId,
		url: status.objectUrl || status.objectId,
		replies_count: 0,
		reblogs_count: reblogged ? 1 : 0,
		favourites_count: favourited ? 1 : 0,
		favourited,
		reblogged,
		muted,
		bookmarked,
		pinned,
		content: status.contentHtml || textToHtmlFallback(status.contentText),
		text: status.contentText || stripHtmlToText(status.contentHtml || ''),
		reblog: null,
		application: {
			name: 'ActivityPub',
			website: status.objectUrl || status.objectId
		},
		account: buildRemoteAccountFromCachedStatus(event, status),
		media_attachments: await serializeMediaAttachments(status.attachments),
		mentions: status.mentions.map((mention) => {
			const acct = mention.name.replace(/^@/, '');
			return {
				id: encodeMastodonAccountId(mention.href),
				username: acct.split('@')[0] || acct,
				url: mention.href,
				acct
			};
		}),
		tags: [],
		emojis: [],
		card: null,
		poll: null,
		filtered: [],
		edited_at: null
	};
}

async function expandOrderedItems(collectionOrPage: Record<string, unknown>) {
	const directItems = Array.isArray(collectionOrPage.orderedItems) ? collectionOrPage.orderedItems : [];
	if (directItems.length) return directItems;

	const first = collectionOrPage.first;
	if (typeof first === 'string' && first) {
		const firstPage = await fetchActivityJson(first);
		return Array.isArray(firstPage.orderedItems) ? firstPage.orderedItems : [];
	}

	if (first && typeof first === 'object') {
		const firstPage = first as Record<string, unknown>;
		return Array.isArray(firstPage.orderedItems) ? firstPage.orderedItems : [];
	}

	return [];
}

export async function fetchRemoteStatusesForActor(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	actorId: string,
	limit = 20,
	options?: {
		preferOriginals?: boolean;
	}
) {
	await syncRemoteStatusesForActor(event, actorId, {
		freshnessMs: 60_000,
		maxPages: 4,
		maxItems: Math.max(limit * 8, 160)
	});
	const cached = await listCachedRemoteStatusesForActor(event, actorId, { limit: Math.max(limit * 4, 80) });
	const originals = cached.filter((item: CachedRemoteStatus) => !item.inReplyToObjectId);
	const replies = cached.filter((item: CachedRemoteStatus) => item.inReplyToObjectId);
	const selected = options?.preferOriginals
		? [...originals, ...replies].slice(0, limit)
		: [...cached].slice(0, limit);

	return (
		await Promise.all(selected.map((item) => serializeCachedRemoteStatus(event, item)))
	).filter(Boolean);
}

export async function buildHomeTimeline(event: Pick<RequestEvent, 'platform' | 'url'>, limit = 40) {
	const following = await listFollowing(event);
	const followedActors = following.slice(0, 8);
	const remoteLimit = followedActors.length ? Math.max(6, Math.floor((limit * 2) / Math.min(followedActors.length, 4))) : 0;

	await Promise.all(
		followedActors.map((item) =>
			syncRemoteStatusesForActor(event, item.actorId, {
				freshnessMs: 60_000,
				maxPages: 4,
				maxItems: Math.max(remoteLimit * 6, 120)
			}).catch(() => [])
		)
	);

	const [localNotes, mirroredStatuses, cachedRemoteStatuses] = await Promise.all([
		listLocalNotes(event, limit),
		getStatuses(),
		listCachedRemoteStatusesForActors(
			event,
			followedActors.map((item) => item.actorId),
			{ limit: Math.max(remoteLimit * followedActors.length, 80) }
		)
	]);

	const localStatuses = await Promise.all(
		localNotes.map((note: LocalApNoteListItem) => serializeLocalNoteStatus(event, note))
	);
	const mirrored = await Promise.all(
		mirroredStatuses.slice(0, limit).map((status: StatusPost) => serializeMirroredStatus(event, status))
	);
	const remote = (
		await Promise.all(
			cachedRemoteStatuses
				.filter((item: CachedRemoteStatus) =>
					followedActors.some((actor) => actor.actorId === item.actorId)
				)
				.slice(0, Math.max(limit * 3, 80))
				.map((item: CachedRemoteStatus) => serializeCachedRemoteStatus(event, item))
		)
	).filter(Boolean);
	const ownStatuses = [...localStatuses, ...mirrored].sort(
		(a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
	);
	const followedStatuses = [...remote].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
	const followedOriginals = followedStatuses.filter((item) => !item.in_reply_to_id);
	const followedReplies = followedStatuses.filter((item) => item.in_reply_to_id);
	const preferredFollowedStatuses = [...followedOriginals, ...followedReplies];

	if (!following.length || !preferredFollowedStatuses.length) {
		return [...ownStatuses, ...preferredFollowedStatuses]
			.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
			.slice(0, limit);
	}

	const reservedRemote = Math.min(
		preferredFollowedStatuses.length,
		Math.max(5, Math.floor(limit / 3))
	);
	const ownSlice = ownStatuses.slice(0, Math.max(0, limit - reservedRemote));
	const remoteSlice = preferredFollowedStatuses.slice(0, reservedRemote);

	return [...ownSlice, ...remoteSlice]
		.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
		.slice(0, limit);
}

export async function buildPublicTimeline(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	options?: {
		limit?: number;
		local?: boolean;
	}
) {
	const limit = Math.max(1, Math.min(options?.limit || 40, 80));
	const following = options?.local ? [] : await listFollowing(event);
	const followedActors = following.slice(0, 8);
	const remoteLimit = followedActors.length ? Math.max(8, Math.floor((limit * 3) / Math.min(followedActors.length, 4))) : 0;

	await Promise.all(
		followedActors.map((item) =>
			syncRemoteStatusesForActor(event, item.actorId, {
				freshnessMs: 60_000,
				maxPages: 4,
				maxItems: Math.max(remoteLimit * 6, 120)
			}).catch(() => [])
		)
	);

	const [localNotes, mirroredStatuses, cachedRemoteStatuses] = await Promise.all([
		listLocalNotes(event, limit),
		getStatuses(),
		options?.local
			? Promise.resolve([])
			: listCachedRemoteStatusesForActors(
					event,
					followedActors.map((item) => item.actorId),
					{ limit: Math.max(remoteLimit * followedActors.length, 100) }
			  )
	]);

	const localStatuses = await Promise.all(
		localNotes.map((note: LocalApNoteListItem) => serializeLocalNoteStatus(event, note))
	);
	const mirrored = await Promise.all(
		mirroredStatuses.slice(0, limit).map((status: StatusPost) => serializeMirroredStatus(event, status))
	);
	const remote = (
		await Promise.all(
			(Array.isArray(cachedRemoteStatuses) ? cachedRemoteStatuses : [])
				.slice(0, Math.max(limit * 4, 100))
				.map((item) => serializeCachedRemoteStatus(event, item))
		)
	).filter(Boolean);
	const ownStatuses = [...localStatuses, ...mirrored].sort(
		(a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
	);
	const followedStatuses = [...remote].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
	const followedOriginals = followedStatuses.filter((item) => !item.in_reply_to_id);
	const followedReplies = followedStatuses.filter((item) => item.in_reply_to_id);
	const preferredFollowedStatuses = [...followedOriginals, ...followedReplies];

	if (options?.local || !preferredFollowedStatuses.length) {
		return [...ownStatuses, ...preferredFollowedStatuses]
			.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
			.slice(0, limit);
	}

	const reservedRemote = Math.min(
		preferredFollowedStatuses.length,
		Math.max(8, Math.floor((limit * 2) / 3))
	);
	const remoteSlice = preferredFollowedStatuses.slice(0, reservedRemote);
	const ownSlice = ownStatuses.slice(0, Math.max(0, limit - reservedRemote));

	return [...remoteSlice, ...ownSlice]
		.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
		.slice(0, limit);
}

export async function listMastodonNotifications(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	limit = 20,
	options?: {
		types?: string[];
		excludeTypes?: string[];
	}
) {
	const origin = getActivityPubOrigin(event);
	const replies = await listRecentInboxReplies(event, origin, limit);
	const includedTypes = new Set((options?.types || []).map((type) => String(type || '').trim()).filter(Boolean));
	const excludedTypes = new Set(
		(options?.excludeTypes || []).map((type) => String(type || '').trim()).filter(Boolean)
	);

	const notifications = (
		await Promise.all(
			replies.map(async (reply) => {
				const type = 'mention';
				if (includedTypes.size && !includedTypes.has(type)) return null;
				if (excludedTypes.has(type)) return null;

				try {
					return {
						id: encodeMastodonStatusId(`notification:${reply.noteId}`),
						type,
						created_at: isoDate(reply.publishedAt),
						account: await buildRemoteAccount(event, reply.actorId),
						status: await serializeReplyNote(event, reply)
					};
				} catch {
					return null;
				}
			})
		)
	)
		.filter((notification) => notification !== null)
		.sort((a, b) => Date.parse(String(b?.created_at || 0)) - Date.parse(String(a?.created_at || 0)));

	return notifications;
}

export function filterMastodonStatuses(
	statuses: Array<Record<string, unknown>>,
	options?: {
		maxId?: string | null;
		sinceId?: string | null;
		minId?: string | null;
		excludeReplies?: boolean;
		excludeReblogs?: boolean;
		onlyMedia?: boolean;
		pinned?: boolean | null;
		limit?: number;
	}
) {
	let filtered = [...statuses];

	if (options?.pinned === true) {
		return [];
	}

	if (options?.excludeReplies) {
		filtered = filtered.filter((item) => !item.in_reply_to_id);
	}

	if (options?.excludeReblogs) {
		filtered = filtered.filter((item) => !item.reblog);
	}

	if (options?.onlyMedia) {
		filtered = filtered.filter((item) => Array.isArray(item.media_attachments) && item.media_attachments.length > 0);
	}

	if (options?.maxId) {
		filtered = filtered.filter((item) => String(item.id || '') < options.maxId!);
	}

	if (options?.sinceId) {
		filtered = filtered.filter((item) => String(item.id || '') > options.sinceId!);
	}

	if (options?.minId) {
		filtered = filtered.filter((item) => String(item.id || '') > options.minId!);
	}

	if (options?.limit) {
		filtered = filtered.slice(0, options.limit);
	}

	return filtered;
}

export async function listGroupedMastodonNotifications(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	limit = 20,
	options?: {
		types?: string[];
		excludeTypes?: string[];
	}
) {
	const notifications = await listMastodonNotifications(event, limit, options);
	const groups = notifications.map((notification, index) => ({
		group_key: `mention:${notification.id}`,
		notifications_count: 1,
		type: notification.type,
		most_recent_notification_id: Number(limit - index),
		page_min_id: null,
		page_max_id: null,
		latest_page_notification_at: notification.created_at,
		sample_account_ids: [String((notification.account as Record<string, unknown>).id || '')].filter(Boolean),
		status_id: notification.status ? String((notification.status as Record<string, unknown>).id || '') : null
	}));

	return {
		accounts: notifications.map((notification) => notification.account),
		statuses: notifications.map((notification) => notification.status).filter(Boolean),
		notification_groups: groups
	};
}

export async function buildMastodonStatusSource(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	objectId: string
) {
	const origin = getActivityPubOrigin(event);

	if (objectId.startsWith(`${origin}/ap/status/`)) {
		const slug = objectId.slice(`${origin}/ap/status/`.length);
		const status = await getStatusBySlug(slug);
		if (!status) return null;

		return {
			id: encodeMastodonStatusId(objectId, status.date),
			text: status.text,
			spoiler_text: ''
		};
	}

	const note = await getNoteById(event, objectId);
	if (note) {
		return {
			id: encodeMastodonStatusId(objectId, note.publishedAt),
			text: note.contentText || stripHtmlToText(note.contentHtml || ''),
			spoiler_text: ''
		};
	}

	const cachedRemoteStatus = await getCachedRemoteStatus(event, objectId);
	if (cachedRemoteStatus) {
		return {
			id: encodeMastodonStatusId(objectId, cachedRemoteStatus.publishedAt),
			text: cachedRemoteStatus.contentText || stripHtmlToText(cachedRemoteStatus.contentHtml || ''),
			spoiler_text: ''
		};
	}

	return null;
}

export function getMastodonNotificationsPolicy() {
	return {
		filter_not_following: false,
		filter_not_followers: false,
		filter_new_accounts: false,
		filter_private_mentions: false,
		filter_limited_accounts: false,
		summary: {
			pending_notifications_count: 0,
			pending_requests_count: 0
		}
	};
}

export async function listMastodonConversations(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	limit = 20
) {
	const origin = getActivityPubOrigin(event);
	const replies = await listRecentInboxReplies(event, origin, limit);

	return await Promise.all(
		replies.map(async (reply) => ({
			id: encodeMastodonStatusId(`conversation:${reply.noteId}`, reply.publishedAt),
			unread: false,
			accounts: [await buildRemoteAccount(event, reply.actorId)],
			last_status: await serializeReplyNote(event, reply)
		}))
	);
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

	const cachedRemoteStatus = await getCachedRemoteStatus(event, objectId);
	if (cachedRemoteStatus) {
		return serializeCachedRemoteStatus(event, cachedRemoteStatus);
	}

	if (objectId.startsWith('http')) {
		try {
			const object = await fetchActivityJson(objectId);
			const type = String(object.type || '');
			let resolvedObject = object;

			if (type === 'Create') {
				const nestedObject = object.object;
				if (typeof nestedObject === 'string') {
					resolvedObject = (await fetchActivityJson(nestedObject).catch(() => null)) || {};
				} else if (nestedObject && typeof nestedObject === 'object') {
					resolvedObject = nestedObject as Record<string, unknown>;
				}
			}

			const actorId = getActorIdFromObject(resolvedObject);
			if (actorId) {
				return await serializeRemoteObjectStatus(event, actorId, resolvedObject);
			}
		} catch {}
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
	const bookmarked = await isObjectBookmarked(event, note.noteId);
	const reblogged = await isObjectReblogged(event, note.noteId);

	return {
		id: encodeMastodonStatusId(note.noteId, note.publishedAt),
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
		reblogs_count: reblogged ? 1 : 0,
		favourites_count: favourited ? 1 : 0,
		favourited,
		reblogged,
		bookmarked,
		content: note.contentHtml || textToHtmlFallback(note.contentText),
		reblog: null,
		application: {
			name: 'ActivityPub',
			website: note.objectUrl || note.noteId
		},
		account: profile,
		media_attachments: await serializeMediaAttachments(note.attachments),
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

export function buildRelationship(
	accountId: string,
	input: { following: boolean; followedBy: boolean; muting?: boolean; blocking?: boolean }
) {
	return {
		id: accountId,
		following: input.following,
		showing_reblogs: true,
		followed_by: input.followedBy,
		blocking: Boolean(input.blocking),
		blocked_by: false,
		muting: Boolean(input.muting),
		muting_notifications: false,
		requested: false,
		domain_blocking: false,
		endorsed: false,
		note: '',
		notifying: false
	};
}

function matchesQuery(value: string | null | undefined, query: string) {
	return String(value || '').toLowerCase().includes(query.toLowerCase());
}

export async function searchAccounts(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	query: string,
	options?: { resolve?: boolean; limit?: number; followingOnly?: boolean }
) {
	const q = String(query || '').trim();
	if (!q) return [];

	const limit = Math.max(1, Math.min(options?.limit || 20, 40));
	const localAccount = await buildLocalAccount(event);
	const followers = options?.followingOnly ? [] : await listFollowers(event);
	const following = await listFollowing(event);
	const accounts = new Map<string, Awaited<ReturnType<typeof buildLocalAccount>>>();

	const push = (account: Awaited<ReturnType<typeof buildLocalAccount>> | null | undefined) => {
		if (!account?.id) return;
		if (!accounts.has(account.id)) {
			accounts.set(account.id, account);
		}
	};

	if (
		matchesQuery(localAccount.username, q) ||
		matchesQuery(localAccount.acct, q) ||
		matchesQuery(localAccount.display_name, q) ||
		matchesQuery(localAccount.url, q)
	) {
		push(localAccount);
	}

	for (const actor of following) {
		if (
			matchesQuery(actor.handle, q) ||
			matchesQuery(actor.displayName, q) ||
			matchesQuery(actor.actorId, q) ||
			matchesQuery(actor.profileUrl, q)
		) {
			push(await buildRemoteAccount(event, actor.actorId));
		}
	}

	if (!options?.followingOnly) {
		for (const actor of followers) {
			if (
				matchesQuery(actor.handle, q) ||
				matchesQuery(actor.displayName, q) ||
				matchesQuery(actor.actorId, q)
			) {
				push(await buildRemoteAccount(event, actor.actorId));
			}
		}
	}

	const looksResolvable = q.includes('@') || q.startsWith('http');
	if (options?.resolve !== false && looksResolvable) {
		try {
			push(await resolveAccountByIdOrAcct(event, q));
		} catch {}
	}

	return Array.from(accounts.values()).slice(0, limit);
}

export function parseMastodonBody(request: Request) {
	const contentType = request.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		return request.json().catch(() => ({}));
	}
	return request.formData().catch(() => new FormData());
}
