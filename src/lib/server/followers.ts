import type { RequestEvent } from '@sveltejs/kit';
import { fetchActivityJson, stripHtmlToText } from '$lib/server/activitypub-replies';

export type FollowerRecord = {
	id: number;
	actorId: string;
	inboxUrl: string | null;
	sharedInboxUrl: string | null;
	displayName: string | null;
	handle: string | null;
	profileUrl: string | null;
	summary: string | null;
	avatarUrl: string | null;
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
	profileUrl?: string | null;
	summary?: string | null;
	avatarUrl?: string | null;
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

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function ensureFollowerStore(event: Pick<RequestEvent, 'platform'>) {
	const db = getDb(event);
	if (!db) return;

	await db
		.prepare(`ALTER TABLE ap_followers ADD COLUMN profile_url TEXT`)
		.run()
		.catch(() => {});

	await db
		.prepare(`ALTER TABLE ap_followers ADD COLUMN summary TEXT`)
		.run()
		.catch(() => {});

	await db
		.prepare(`ALTER TABLE ap_followers ADD COLUMN avatar_url TEXT`)
		.run()
		.catch(() => {});
}

async function hydrateFollowerMetadata(
	event: Pick<RequestEvent, 'platform'>,
	record: FollowerRecord
): Promise<FollowerRecord> {
	const db = getDb(event);
	if (!db) return record;

	if (record.profileUrl && record.summary && record.avatarUrl) {
		return record;
	}

	try {
		const actorDoc = await fetchActivityJson(record.actorId);
		const icon =
			actorDoc.icon && typeof actorDoc.icon === 'object'
				? (actorDoc.icon as Record<string, unknown>)
				: null;
		const profileUrl = record.profileUrl || getString(actorDoc.url);
		const summary = record.summary || getString(stripHtmlToText(String(actorDoc.summary || '')));
		const avatarUrl = record.avatarUrl || getString(icon?.url);

		await db
			.prepare(
				`UPDATE ap_followers
				 SET profile_url = COALESCE(?, profile_url),
				     summary = COALESCE(?, summary),
				     avatar_url = COALESCE(?, avatar_url),
				     updated_at = CURRENT_TIMESTAMP
				 WHERE actor_id = ?`
			)
			.bind(profileUrl, summary, avatarUrl, record.actorId)
			.run();

		return {
			...record,
			profileUrl,
			summary,
			avatarUrl
		};
	} catch {
		return record;
	}
}

export async function listFollowers(event: Pick<RequestEvent, 'platform'>): Promise<FollowerRecord[]> {
	const db = getDb(event);
	if (!db) return [];
	await ensureFollowerStore(event);

	const result = await db
		.prepare(
			`SELECT id, actor_id, inbox_url, shared_inbox_url, display_name, handle, profile_url, summary, avatar_url,
			        follow_activity_id, accepted_at, last_delivery_at, last_delivery_status,
			        created_at, updated_at
			 FROM ap_followers
			 ORDER BY accepted_at DESC`
		)
		.all<Record<string, unknown>>();

	const records = (result.results || []).map((row: Record<string, unknown>) => ({
		id: Number(row.id),
		actorId: String(row.actor_id || ''),
		inboxUrl: row.inbox_url ? String(row.inbox_url) : null,
		sharedInboxUrl: row.shared_inbox_url ? String(row.shared_inbox_url) : null,
		displayName: row.display_name ? String(row.display_name) : null,
		handle: row.handle ? String(row.handle) : null,
		profileUrl: getString(row.profile_url),
		summary: getString(row.summary),
		avatarUrl: getString(row.avatar_url),
		followActivityId: String(row.follow_activity_id || ''),
		acceptedAt: String(row.accepted_at || ''),
		lastDeliveryAt: row.last_delivery_at ? String(row.last_delivery_at) : null,
		lastDeliveryStatus: row.last_delivery_status ? String(row.last_delivery_status) : null,
		createdAt: String(row.created_at || ''),
		updatedAt: String(row.updated_at || '')
	}));

	return Promise.all(records.map((record: FollowerRecord) => hydrateFollowerMetadata(event, record)));
}

export async function countFollowers(event: Pick<RequestEvent, 'platform'>) {
	const db = getDb(event);
	if (!db) return 0;
	await ensureFollowerStore(event);

	const row = await db
		.prepare(`SELECT COUNT(*) AS follower_count FROM ap_followers`)
		.first<Record<string, unknown>>();

	return Number(row?.follower_count || 0);
}

export async function upsertFollower(
	event: Pick<RequestEvent, 'platform'>,
	input: CreateFollowerInput
): Promise<void> {
	const db = getDb(event);
	if (!db) {
		throw new Error('AP_DB is not configured');
	}
	await ensureFollowerStore(event);

	let profileUrl = getString(input.profileUrl);
	let summary = getString(input.summary);
	let avatarUrl = getString(input.avatarUrl);

	if (!profileUrl || !summary || !avatarUrl) {
		try {
			const actorDoc = await fetchActivityJson(input.actorId);
			const icon =
				actorDoc.icon && typeof actorDoc.icon === 'object'
					? (actorDoc.icon as Record<string, unknown>)
					: null;
			profileUrl = profileUrl || getString(actorDoc.url);
			summary = summary || getString(stripHtmlToText(String(actorDoc.summary || '')));
			avatarUrl = avatarUrl || getString(icon?.url);
		} catch {}
	}

	await db
		.prepare(
			`INSERT INTO ap_followers (
				actor_id, inbox_url, shared_inbox_url, display_name, handle, profile_url, summary, avatar_url, follow_activity_id
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(actor_id) DO UPDATE SET
				inbox_url = excluded.inbox_url,
				shared_inbox_url = excluded.shared_inbox_url,
				display_name = excluded.display_name,
				handle = excluded.handle,
				profile_url = excluded.profile_url,
				summary = excluded.summary,
				avatar_url = excluded.avatar_url,
				follow_activity_id = excluded.follow_activity_id,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			input.actorId,
			input.inboxUrl || null,
			input.sharedInboxUrl || null,
			input.displayName || null,
			input.handle || null,
			profileUrl,
			summary,
			avatarUrl,
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
