import { fetchActivityJson, fetchRemoteActor, stripHtmlToText, textToParagraphHtml } from '$lib/server/activitypub-replies';
import type { RequestEvent } from '@sveltejs/kit';

type RemoteStatusRow = Record<string, unknown>;

export type CachedRemoteStatus = {
	objectId: string;
	actorId: string;
	actorName: string | null;
	actorHandle: string | null;
	actorSummary: string | null;
	actorUrl: string | null;
	actorAvatarUrl: string | null;
	actorHeaderUrl: string | null;
	contentHtml: string;
	contentText: string;
	publishedAt: string;
	objectUrl: string | null;
	inReplyToObjectId: string | null;
	attachments: Array<{
		url: string;
		mediaType: string;
		alt: string;
	}>;
	mentions: Array<{
		href: string;
		name: string;
	}>;
	rawObjectJson: string | null;
	fetchedAt: string;
	createdAt: string;
	updatedAt: string;
};

function getDb(event: Pick<RequestEvent, 'platform'>) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isoDaysAgo(days: number) {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() - days);
	return date.toISOString();
}

function normalizeActorHandle(actorId: string, handle: string | null) {
	if (!handle) return null;
	if (handle.includes('@')) return handle.replace(/^@+/, '');
	return `${handle.replace(/^@+/, '')}@${new URL(actorId).host}`;
}

function mapAttachments(value: unknown) {
	const items = Array.isArray(value) ? value : [];
	return items
		.map((item) => {
			if (!item || typeof item !== 'object') return null;
			const record = item as Record<string, unknown>;
			const url = getString(record.url);
			if (!url) return null;

			return {
				url,
				mediaType: getString(record.mediaType) || 'image/jpeg',
				alt: getString(record.alt) || ''
			};
		})
		.filter(
			(item): item is { url: string; mediaType: string; alt: string } => Boolean(item)
		);
}

function mapMentions(value: unknown) {
	const items = Array.isArray(value) ? value : [];
	return items
		.map((item) => {
			if (!item || typeof item !== 'object') return null;
			const record = item as Record<string, unknown>;
			const href = getString(record.href);
			const name = getString(record.name);
			if (!href || !name) return null;
			return { href, name };
		})
		.filter((item): item is { href: string; name: string } => Boolean(item));
}

function mapRow(row: RemoteStatusRow): CachedRemoteStatus {
	let attachments: CachedRemoteStatus['attachments'] = [];
	let mentions: CachedRemoteStatus['mentions'] = [];

	try {
		attachments = mapAttachments(JSON.parse(String(row.attachments_json || '[]')));
	} catch {}

	try {
		mentions = mapMentions(JSON.parse(String(row.mentions_json || '[]')));
	} catch {}

	return {
		objectId: String(row.object_id || ''),
		actorId: String(row.actor_id || ''),
		actorName: getString(row.actor_name),
		actorHandle: getString(row.actor_handle),
		actorSummary: getString(row.actor_summary),
		actorUrl: getString(row.actor_url),
		actorAvatarUrl: getString(row.actor_avatar_url),
		actorHeaderUrl: getString(row.actor_header_url),
		contentHtml: String(row.content_html || ''),
		contentText: String(row.content_text || ''),
		publishedAt: String(row.published_at || ''),
		objectUrl: getString(row.object_url),
		inReplyToObjectId: getString(row.in_reply_to_object_id),
		attachments,
		mentions,
		rawObjectJson: getString(row.raw_object_json),
		fetchedAt: String(row.fetched_at || ''),
		createdAt: String(row.created_at || ''),
		updatedAt: String(row.updated_at || '')
	};
}

async function ensureRemoteStatusStore(event: Pick<RequestEvent, 'platform'>) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS mastodon_remote_statuses (
				object_id TEXT PRIMARY KEY,
				actor_id TEXT NOT NULL,
				actor_name TEXT,
				actor_handle TEXT,
				actor_summary TEXT,
				actor_url TEXT,
				actor_avatar_url TEXT,
				actor_header_url TEXT,
				content_html TEXT NOT NULL,
				content_text TEXT NOT NULL,
				published_at TEXT NOT NULL,
				object_url TEXT,
				in_reply_to_object_id TEXT,
				attachments_json TEXT NOT NULL DEFAULT '[]',
				mentions_json TEXT NOT NULL DEFAULT '[]',
				raw_object_json TEXT,
				fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
				created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`
		)
		.run();

	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_mastodon_remote_statuses_actor_published
			 ON mastodon_remote_statuses(actor_id, published_at DESC)`
		)
		.run();

	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_mastodon_remote_statuses_reply_target
			 ON mastodon_remote_statuses(in_reply_to_object_id)`
		)
		.run();
}

export async function pruneRemoteStatusCache(
	event: Pick<RequestEvent, 'platform'>,
	options?: {
		retentionDays?: number;
	}
) {
	const db = getDb(event);
	if (!db) return;

	await ensureRemoteStatusStore(event);

	const retentionDays = Math.max(1, Math.min(options?.retentionDays || 14, 90));
	const cutoff = isoDaysAgo(retentionDays);

	await db
		.prepare(
			`DELETE FROM mastodon_remote_statuses
			 WHERE COALESCE(published_at, fetched_at, created_at) < ?`
		)
		.bind(cutoff)
		.run();
}

async function resolveFirstPage(collectionOrPage: Record<string, unknown>) {
	if (Array.isArray(collectionOrPage.orderedItems)) {
		return collectionOrPage;
	}

	const first = collectionOrPage.first;
	if (typeof first === 'string' && first) {
		return await fetchActivityJson(first);
	}

	if (first && typeof first === 'object') {
		return first as Record<string, unknown>;
	}

	return null;
}

async function collectOrderedItems(
	collectionOrPage: Record<string, unknown>,
	options?: {
		maxPages?: number;
		maxItems?: number;
	}
) {
	const maxPages = Math.max(1, options?.maxPages || 4);
	const maxItems = Math.max(20, options?.maxItems || 120);
	const items: unknown[] = [];
	let page = await resolveFirstPage(collectionOrPage);
	let pageCount = 0;

	while (page && pageCount < maxPages && items.length < maxItems) {
		const orderedItems = Array.isArray(page.orderedItems) ? page.orderedItems : [];
		for (const item of orderedItems) {
			items.push(item);
			if (items.length >= maxItems) break;
		}

		pageCount += 1;
		if (items.length >= maxItems) break;

		const next = page.next;
		if (typeof next === 'string' && next) {
			page = await fetchActivityJson(next).catch(() => null);
			continue;
		}

		if (next && typeof next === 'object') {
			page = next as Record<string, unknown>;
			continue;
		}

		break;
	}

	return items;
}

async function resolveOutboxObject(item: unknown) {
	let record: Record<string, unknown> | null = null;
	if (typeof item === 'string') {
		record = await fetchActivityJson(item).catch(() => null);
	} else if (item && typeof item === 'object') {
		record = item as Record<string, unknown>;
	}

	if (!record) return null;

	const type = String(record.type || '');
	if (type === 'Create') {
		const activityObject = record.object;
		if (typeof activityObject === 'string') {
			return (await fetchActivityJson(activityObject).catch(() => null)) as Record<string, unknown> | null;
		}
		if (activityObject && typeof activityObject === 'object') {
			return activityObject as Record<string, unknown>;
		}
	}

	return record;
}

function serializeAttachmentJson(value: unknown) {
	const items = Array.isArray(value) ? value : value ? [value] : [];

	return items
		.map((item) => {
			if (!item || typeof item !== 'object') return null;
			const record = item as Record<string, unknown>;
			const url = getString(record.url);
			if (!url) return null;
			return {
				url,
				mediaType: getString(record.mediaType) || 'image/jpeg',
				alt: getString(record.name) || ''
			};
		})
		.filter(Boolean);
}

function serializeMentionJson(value: unknown) {
	const items = Array.isArray(value) ? value : [];

	return items
		.map((item) => {
			if (!item || typeof item !== 'object') return null;
			const record = item as Record<string, unknown>;
			if (String(record.type || '') !== 'Mention') return null;
			const href = getString(record.href);
			const name = getString(record.name);
			if (!href || !name) return null;
			return { href, name };
		})
		.filter(Boolean);
}

export async function syncRemoteStatusesForActor(
	event: Pick<RequestEvent, 'platform'>,
	actorId: string,
	options?: {
		force?: boolean;
		freshnessMs?: number;
		maxPages?: number;
		maxItems?: number;
	}
) {
	const db = getDb(event);
	if (!db) return [];

	await ensureRemoteStatusStore(event);
	await pruneRemoteStatusCache(event);

	const freshnessMs = Math.max(15_000, options?.freshnessMs || 120_000);
	if (!options?.force) {
		const lastSync = await db
			.prepare(
				`SELECT fetched_at
				 FROM mastodon_remote_statuses
				 WHERE actor_id = ?
				 ORDER BY fetched_at DESC
				 LIMIT 1`
			)
			.bind(actorId)
			.first<{ fetched_at?: string }>();

		const fetchedAt = getString(lastSync?.fetched_at);
		if (fetchedAt && Date.now() - Date.parse(fetchedAt) < freshnessMs) {
			return listCachedRemoteStatusesForActor(event, actorId, { limit: 60 });
		}
	}

	const actorDoc = await fetchActivityJson(actorId);
	const actorMeta = await fetchRemoteActor(actorId);
	const outboxUrl = getString(actorDoc.outbox);
	if (!outboxUrl) return [];

	const outbox = await fetchActivityJson(outboxUrl);
	const orderedItems = await collectOrderedItems(outbox, {
		maxPages: options?.maxPages || 4,
		maxItems: options?.maxItems || 160
	});
	const fetchedAt = new Date().toISOString();
	const icon =
		actorDoc.icon && typeof actorDoc.icon === 'object' ? (actorDoc.icon as Record<string, unknown>) : null;
	const image =
		actorDoc.image && typeof actorDoc.image === 'object' ? (actorDoc.image as Record<string, unknown>) : null;
	const actorHandle = normalizeActorHandle(actorId, actorMeta.handle);
	const actorUrl = getString(actorDoc.url) || actorId;
	const actorAvatarUrl = getString(icon?.url);
	const actorHeaderUrl = getString(image?.url) || actorAvatarUrl;
	const actorSummary = getString(actorDoc.summary);

	for (const item of orderedItems) {
		const object = await resolveOutboxObject(item);
		if (!object) continue;

		const objectType = String(object.type || '');
		if (!['Note', 'Article', 'Page'].includes(objectType)) continue;

		const objectId = getString(object.id) || getString(object.url);
		if (!objectId) continue;

		const contentHtml =
			getString(object.content) ||
			textToParagraphHtml(stripHtmlToText(getString(object.summary) || getString(object.name) || ''));
		const contentText = stripHtmlToText(contentHtml);
		const publishedAt = getString(object.published) || getString(object.updated) || fetchedAt;

		await db
			.prepare(
				`INSERT INTO mastodon_remote_statuses (
					object_id, actor_id, actor_name, actor_handle, actor_summary, actor_url,
					actor_avatar_url, actor_header_url, content_html, content_text, published_at,
					object_url, in_reply_to_object_id, attachments_json, mentions_json, raw_object_json, fetched_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(object_id) DO UPDATE SET
					actor_id = excluded.actor_id,
					actor_name = excluded.actor_name,
					actor_handle = excluded.actor_handle,
					actor_summary = excluded.actor_summary,
					actor_url = excluded.actor_url,
					actor_avatar_url = excluded.actor_avatar_url,
					actor_header_url = excluded.actor_header_url,
					content_html = excluded.content_html,
					content_text = excluded.content_text,
					published_at = excluded.published_at,
					object_url = excluded.object_url,
					in_reply_to_object_id = excluded.in_reply_to_object_id,
					attachments_json = excluded.attachments_json,
					mentions_json = excluded.mentions_json,
					raw_object_json = excluded.raw_object_json,
					fetched_at = excluded.fetched_at,
					updated_at = CURRENT_TIMESTAMP`
			)
			.bind(
				objectId,
				actorId,
				actorMeta.name,
				actorHandle,
				actorSummary,
				actorUrl,
				actorAvatarUrl,
				actorHeaderUrl,
				contentHtml,
				contentText,
				publishedAt,
				getString(object.url) || objectId,
				getString(object.inReplyTo),
				JSON.stringify(serializeAttachmentJson(object.attachment)),
				JSON.stringify(serializeMentionJson(object.tag)),
				JSON.stringify(object),
				fetchedAt
			)
			.run();
	}

	return listCachedRemoteStatusesForActor(event, actorId, { limit: 60 });
}

export async function cacheRemoteStatusObject(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		actorId: string;
		object: Record<string, unknown>;
		actorName?: string | null;
		actorHandle?: string | null;
		actorSummary?: string | null;
		actorUrl?: string | null;
		actorAvatarUrl?: string | null;
		actorHeaderUrl?: string | null;
		fetchedAt?: string;
	}
) {
	const db = getDb(event);
	if (!db) return null;

	await ensureRemoteStatusStore(event);
	await pruneRemoteStatusCache(event);

	const objectType = String(input.object.type || '');
	if (!['Note', 'Article', 'Page'].includes(objectType)) return null;

	const objectId = getString(input.object.id) || getString(input.object.url);
	if (!objectId) return null;

	const contentHtml =
		getString(input.object.content) ||
		textToParagraphHtml(
			stripHtmlToText(getString(input.object.summary) || getString(input.object.name) || '')
		);
	const contentText = stripHtmlToText(contentHtml);
	const fetchedAt = input.fetchedAt || new Date().toISOString();

	await db
		.prepare(
			`INSERT INTO mastodon_remote_statuses (
				object_id, actor_id, actor_name, actor_handle, actor_summary, actor_url,
				actor_avatar_url, actor_header_url, content_html, content_text, published_at,
				object_url, in_reply_to_object_id, attachments_json, mentions_json, raw_object_json, fetched_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(object_id) DO UPDATE SET
				actor_id = excluded.actor_id,
				actor_name = excluded.actor_name,
				actor_handle = excluded.actor_handle,
				actor_summary = excluded.actor_summary,
				actor_url = excluded.actor_url,
				actor_avatar_url = excluded.actor_avatar_url,
				actor_header_url = excluded.actor_header_url,
				content_html = excluded.content_html,
				content_text = excluded.content_text,
				published_at = excluded.published_at,
				object_url = excluded.object_url,
				in_reply_to_object_id = excluded.in_reply_to_object_id,
				attachments_json = excluded.attachments_json,
				mentions_json = excluded.mentions_json,
				raw_object_json = excluded.raw_object_json,
				fetched_at = excluded.fetched_at,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			objectId,
			input.actorId,
			input.actorName ?? null,
			normalizeActorHandle(input.actorId, input.actorHandle ?? null),
			input.actorSummary ?? null,
			input.actorUrl ?? input.actorId,
			input.actorAvatarUrl ?? null,
			input.actorHeaderUrl ?? input.actorAvatarUrl ?? null,
			contentHtml,
			contentText,
			getString(input.object.published) || getString(input.object.updated) || fetchedAt,
			getString(input.object.url) || objectId,
			getString(input.object.inReplyTo),
			JSON.stringify(serializeAttachmentJson(input.object.attachment)),
			JSON.stringify(serializeMentionJson(input.object.tag)),
			JSON.stringify(input.object),
			fetchedAt
		)
		.run();

	return getCachedRemoteStatus(event, objectId);
}

export async function listCachedRemoteStatusesForActor(
	event: Pick<RequestEvent, 'platform'>,
	actorId: string,
	options?: {
		limit?: number;
	}
) {
	const db = getDb(event);
	if (!db) return [];

	await ensureRemoteStatusStore(event);
	await pruneRemoteStatusCache(event);

	const limit = Math.max(1, Math.min(options?.limit || 20, 200));
	const result = await db
		.prepare(
			`SELECT object_id, actor_id, actor_name, actor_handle, actor_summary, actor_url,
			        actor_avatar_url, actor_header_url, content_html, content_text, published_at,
			        object_url, in_reply_to_object_id, attachments_json, mentions_json,
			        raw_object_json, fetched_at, created_at, updated_at
			 FROM mastodon_remote_statuses
			 WHERE actor_id = ?
			 ORDER BY published_at DESC, object_id DESC
			 LIMIT ?`
		)
		.bind(actorId, limit)
		.all<RemoteStatusRow>();

	return (result.results || []).map(mapRow);
}

export async function listCachedRemoteStatusesForActors(
	event: Pick<RequestEvent, 'platform'>,
	actorIds: string[],
	options?: {
		limit?: number;
	}
) {
	const db = getDb(event);
	if (!db || !actorIds.length) return [];

	await ensureRemoteStatusStore(event);
	await pruneRemoteStatusCache(event);

	const limit = Math.max(1, Math.min(options?.limit || 80, 300));
	const placeholders = actorIds.map(() => '?').join(', ');
	const result = await db
		.prepare(
			`SELECT object_id, actor_id, actor_name, actor_handle, actor_summary, actor_url,
			        actor_avatar_url, actor_header_url, content_html, content_text, published_at,
			        object_url, in_reply_to_object_id, attachments_json, mentions_json,
			        raw_object_json, fetched_at, created_at, updated_at
			 FROM mastodon_remote_statuses
			 WHERE actor_id IN (${placeholders})
			 ORDER BY published_at DESC, object_id DESC
			 LIMIT ?`
		)
		.bind(...actorIds, limit)
		.all<RemoteStatusRow>();

	return (result.results || []).map(mapRow);
}

export async function getCachedRemoteStatus(
	event: Pick<RequestEvent, 'platform'>,
	objectId: string
) {
	const db = getDb(event);
	if (!db) return null;

	await ensureRemoteStatusStore(event);
	await pruneRemoteStatusCache(event);

	const row = await db
		.prepare(
			`SELECT object_id, actor_id, actor_name, actor_handle, actor_summary, actor_url,
			        actor_avatar_url, actor_header_url, content_html, content_text, published_at,
			        object_url, in_reply_to_object_id, attachments_json, mentions_json,
			        raw_object_json, fetched_at, created_at, updated_at
			 FROM mastodon_remote_statuses
			 WHERE object_id = ?
			 LIMIT 1`
		)
		.bind(objectId)
		.first<RemoteStatusRow>();

	return row ? mapRow(row) : null;
}
