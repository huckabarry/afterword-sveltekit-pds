import type { RequestEvent } from '@sveltejs/kit';

export type FollowerRecord = {
	id: number;
	actorId: string;
	inboxUrl: string | null;
	sharedInboxUrl: string | null;
	displayName: string | null;
	handle: string | null;
	followActivityId: string;
	acceptedAt: string;
	lastDeliveryAt: string | null;
	lastDeliveryStatus: string | null;
	createdAt: string;
	updatedAt: string;
};

export type CreateFollowerInput = {
	actorId: string;
	inboxUrl?: string | null;
	sharedInboxUrl?: string | null;
	displayName?: string | null;
	handle?: string | null;
	followActivityId: string;
};

function getDb(event: Pick<RequestEvent, 'platform'>) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

export function hasFollowerDb(event: Pick<RequestEvent, 'platform'>) {
	return Boolean(getDb(event));
}

export async function listFollowers(event: Pick<RequestEvent, 'platform'>): Promise<FollowerRecord[]> {
	const db = getDb(event);
	if (!db) return [];

	const result = await db
		.prepare(
			`SELECT id, actor_id, inbox_url, shared_inbox_url, display_name, handle,
			        follow_activity_id, accepted_at, last_delivery_at, last_delivery_status,
			        created_at, updated_at
			 FROM ap_followers
			 ORDER BY accepted_at DESC`
		)
		.all<Record<string, unknown>>();

	return (result.results || []).map((row: Record<string, unknown>) => ({
		id: Number(row.id),
		actorId: String(row.actor_id || ''),
		inboxUrl: row.inbox_url ? String(row.inbox_url) : null,
		sharedInboxUrl: row.shared_inbox_url ? String(row.shared_inbox_url) : null,
		displayName: row.display_name ? String(row.display_name) : null,
		handle: row.handle ? String(row.handle) : null,
		followActivityId: String(row.follow_activity_id || ''),
		acceptedAt: String(row.accepted_at || ''),
		lastDeliveryAt: row.last_delivery_at ? String(row.last_delivery_at) : null,
		lastDeliveryStatus: row.last_delivery_status ? String(row.last_delivery_status) : null,
		createdAt: String(row.created_at || ''),
		updatedAt: String(row.updated_at || '')
	}));
}

export async function upsertFollower(
	event: Pick<RequestEvent, 'platform'>,
	input: CreateFollowerInput
): Promise<void> {
	const db = getDb(event);
	if (!db) {
		throw new Error('AP_DB is not configured');
	}

	await db
		.prepare(
			`INSERT INTO ap_followers (
				actor_id, inbox_url, shared_inbox_url, display_name, handle, follow_activity_id
			) VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(actor_id) DO UPDATE SET
				inbox_url = excluded.inbox_url,
				shared_inbox_url = excluded.shared_inbox_url,
				display_name = excluded.display_name,
				handle = excluded.handle,
				follow_activity_id = excluded.follow_activity_id,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			input.actorId,
			input.inboxUrl || null,
			input.sharedInboxUrl || null,
			input.displayName || null,
			input.handle || null,
			input.followActivityId
		)
		.run();
}

export async function updateFollowerDeliveryStatus(
	event: Pick<RequestEvent, 'platform'>,
	actorId: string,
	status: string
): Promise<void> {
	const db = getDb(event);
	if (!db) {
		throw new Error('AP_DB is not configured');
	}

	await db
		.prepare(
			`UPDATE ap_followers
			 SET last_delivery_status = ?,
			     last_delivery_at = CURRENT_TIMESTAMP,
			     updated_at = CURRENT_TIMESTAMP
			 WHERE actor_id = ?`
		)
		.bind(status, actorId)
		.run();
}
