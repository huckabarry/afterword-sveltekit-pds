import type { RequestEvent } from '@sveltejs/kit';
import { getActorId } from '$lib/server/activitypub';

function getDb(event: Pick<RequestEvent, 'platform'>) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

export type ApNoteRecord = {
	id: number;
	noteId: string;
	origin: 'local' | 'remote';
	activityId: string | null;
	actorId: string;
	actorName: string | null;
	actorHandle: string | null;
	inReplyToObjectId: string | null;
	threadRootObjectId: string | null;
	contentHtml: string;
	contentText: string;
	publishedAt: string;
	objectUrl: string | null;
	localSlug: string | null;
	deliveryStatus: string | null;
	rawActivityJson: string | null;
	createdAt: string;
	updatedAt: string;
};

export type LocalApNoteListItem = ApNoteRecord & {
	incomingReplyCount: number;
};

function mapNote(row: Record<string, unknown>): ApNoteRecord {
	return {
		id: Number(row.id || 0),
		noteId: String(row.note_id || ''),
		origin: String(row.origin || 'remote') === 'local' ? 'local' : 'remote',
		activityId: row.activity_id ? String(row.activity_id) : null,
		actorId: String(row.actor_id || ''),
		actorName: row.actor_name ? String(row.actor_name) : null,
		actorHandle: row.actor_handle ? String(row.actor_handle) : null,
		inReplyToObjectId: row.in_reply_to_object_id ? String(row.in_reply_to_object_id) : null,
		threadRootObjectId: row.thread_root_object_id ? String(row.thread_root_object_id) : null,
		contentHtml: String(row.content_html || ''),
		contentText: String(row.content_text || ''),
		publishedAt: String(row.published_at || ''),
		objectUrl: row.object_url ? String(row.object_url) : null,
		localSlug: row.local_slug ? String(row.local_slug) : null,
		deliveryStatus: row.delivery_status ? String(row.delivery_status) : null,
		rawActivityJson: row.raw_activity_json ? String(row.raw_activity_json) : null,
		createdAt: String(row.created_at || ''),
		updatedAt: String(row.updated_at || '')
	};
}

function makeLocalReplySlug() {
	return `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function storeRemoteReply(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		noteId: string;
		activityId: string | null;
		actorId: string;
		actorName?: string | null;
		actorHandle?: string | null;
		inReplyToObjectId?: string | null;
		threadRootObjectId?: string | null;
		contentHtml: string;
		contentText: string;
		publishedAt: string;
		objectUrl?: string | null;
		rawActivityJson: string;
	}
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	await db
		.prepare(
			`INSERT INTO ap_notes (
				note_id, origin, activity_id, actor_id, actor_name, actor_handle,
				in_reply_to_object_id, thread_root_object_id, content_html, content_text,
				published_at, object_url, raw_activity_json
			) VALUES (?, 'remote', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(note_id) DO UPDATE SET
				activity_id = excluded.activity_id,
				actor_id = excluded.actor_id,
				actor_name = excluded.actor_name,
				actor_handle = excluded.actor_handle,
				in_reply_to_object_id = excluded.in_reply_to_object_id,
				thread_root_object_id = excluded.thread_root_object_id,
				content_html = excluded.content_html,
				content_text = excluded.content_text,
				published_at = excluded.published_at,
				object_url = excluded.object_url,
				raw_activity_json = excluded.raw_activity_json,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			input.noteId,
			input.activityId ?? null,
			input.actorId,
			input.actorName ?? null,
			input.actorHandle ?? null,
			input.inReplyToObjectId ?? null,
			input.threadRootObjectId ?? null,
			input.contentHtml,
			input.contentText,
			input.publishedAt,
			input.objectUrl ?? null,
			input.rawActivityJson
		)
		.run();
}

export async function createLocalReply(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	input: {
		inReplyToObjectId: string;
		threadRootObjectId?: string | null;
		contentHtml: string;
		contentText: string;
	}
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	const slug = makeLocalReplySlug();
	const noteId = `${event.url.origin}/ap/replies/${slug}`;
	const actorId = getActorId(event.url.origin);
	const publishedAt = new Date().toISOString();

	await db
		.prepare(
			`INSERT INTO ap_notes (
				note_id, origin, actor_id, in_reply_to_object_id, thread_root_object_id,
				content_html, content_text, published_at, object_url, local_slug, delivery_status
			) VALUES (?, 'local', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			noteId,
			actorId,
			input.inReplyToObjectId,
			input.threadRootObjectId ?? input.inReplyToObjectId,
			input.contentHtml,
			input.contentText,
			publishedAt,
			noteId,
			slug,
			'pending'
		)
		.run();

	return getLocalReplyBySlug(event, slug);
}

export async function createLocalNote(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	input: {
		contentHtml: string;
		contentText: string;
	}
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	const slug = makeLocalReplySlug();
	const noteId = `${event.url.origin}/ap/notes/${slug}`;
	const actorId = getActorId(event.url.origin);
	const publishedAt = new Date().toISOString();

	await db
		.prepare(
			`INSERT INTO ap_notes (
				note_id, origin, actor_id, thread_root_object_id, content_html, content_text,
				published_at, object_url, local_slug, delivery_status
			) VALUES (?, 'local', ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			noteId,
			actorId,
			noteId,
			input.contentHtml,
			input.contentText,
			publishedAt,
			noteId,
			slug,
			'pending'
		)
		.run();

	return getLocalReplyBySlug(event, slug);
}

export async function updateLocalReplyDeliveryStatus(
	event: Pick<RequestEvent, 'platform'>,
	slug: string,
	status: string
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	await db
		.prepare(
			`UPDATE ap_notes
			 SET delivery_status = ?, updated_at = CURRENT_TIMESTAMP
			 WHERE local_slug = ?`
		)
		.bind(status, slug)
		.run();
}

export async function listNotesForThread(
	event: Pick<RequestEvent, 'platform'>,
	threadRootObjectId: string
): Promise<ApNoteRecord[]> {
	const db = getDb(event);
	if (!db) {
		return [];
	}

	const result = await db
		.prepare(
			`SELECT *
			 FROM ap_notes
			 WHERE thread_root_object_id = ?
			    OR in_reply_to_object_id = ?
			 ORDER BY published_at ASC, created_at ASC`
		)
		.bind(threadRootObjectId, threadRootObjectId)
		.all<Record<string, unknown>>();

	return (result.results || []).map(mapNote);
}

export async function listRecentRemoteReplies(
	event: Pick<RequestEvent, 'platform'>,
	limit = 25
): Promise<ApNoteRecord[]> {
	const db = getDb(event);
	if (!db) {
		return [];
	}

	const safeLimit = Math.max(1, Math.min(limit, 100));
	const result = await db
		.prepare(
			`SELECT *
			 FROM ap_notes
			 WHERE origin = 'remote'
			 ORDER BY published_at DESC, created_at DESC
			 LIMIT ?`
		)
		.bind(safeLimit)
		.all<Record<string, unknown>>();

	return (result.results || []).map(mapNote);
}

export async function listLocalNotes(
	event: Pick<RequestEvent, 'platform'>,
	limit = 100
): Promise<LocalApNoteListItem[]> {
	const db = getDb(event);
	if (!db) {
		return [];
	}

	const safeLimit = Math.max(1, Math.min(limit, 500));
	const result = await db
		.prepare(
			`SELECT n.*,
			        (
			        	SELECT COUNT(*)
			        	FROM ap_notes r
			        	WHERE r.in_reply_to_object_id = n.note_id
			        ) AS incoming_reply_count
			 FROM ap_notes n
			 WHERE n.origin = 'local'
			 ORDER BY n.published_at DESC, n.created_at DESC
			 LIMIT ?`
		)
		.bind(safeLimit)
		.all<Record<string, unknown>>();

	return (result.results || []).map((row: Record<string, unknown>) => ({
		...mapNote(row),
		incomingReplyCount: Number(row.incoming_reply_count || 0)
	}));
}

export async function listDirectRepliesToObject(
	event: Pick<RequestEvent, 'platform'>,
	objectId: string
): Promise<ApNoteRecord[]> {
	const db = getDb(event);
	if (!db) {
		return [];
	}

	const result = await db
		.prepare(
			`SELECT *
			 FROM ap_notes
			 WHERE in_reply_to_object_id = ?
			 ORDER BY published_at ASC, created_at ASC`
		)
		.bind(objectId)
		.all<Record<string, unknown>>();

	return (result.results || []).map(mapNote);
}

export async function getLocalReplyBySlug(
	event: Pick<RequestEvent, 'platform'>,
	slug: string
): Promise<ApNoteRecord | null> {
	const db = getDb(event);
	if (!db) {
		return null;
	}

	const row = await db
		.prepare(`SELECT * FROM ap_notes WHERE local_slug = ? LIMIT 1`)
		.bind(slug)
		.first<Record<string, unknown>>();

	return row ? mapNote(row) : null;
}

export async function updateLocalNoteBySlug(
	event: Pick<RequestEvent, 'platform'>,
	slug: string,
	input: {
		contentHtml: string;
		contentText: string;
	}
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	await db
		.prepare(
			`UPDATE ap_notes
			 SET content_html = ?,
			     content_text = ?,
			     updated_at = CURRENT_TIMESTAMP
			 WHERE local_slug = ?
			   AND origin = 'local'`
		)
		.bind(input.contentHtml, input.contentText, slug)
		.run();
}

export async function deleteLocalNoteBySlug(
	event: Pick<RequestEvent, 'platform'>,
	slug: string
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	await db
		.prepare(
			`DELETE FROM ap_notes
			 WHERE local_slug = ?
			   AND origin = 'local'`
		)
		.bind(slug)
		.run();
}
