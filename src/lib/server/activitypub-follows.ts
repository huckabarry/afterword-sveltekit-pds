import { getActorId } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { fetchActivityJson, fetchRemoteActor, stripHtmlToText } from '$lib/server/activitypub-replies';
import type { RequestEvent } from '@sveltejs/kit';

type FollowingRow = Record<string, unknown>;

export type FollowingRecord = {
	actorId: string;
	inboxUrl: string | null;
	sharedInboxUrl: string | null;
	displayName: string | null;
	handle: string | null;
	profileUrl: string | null;
	summary: string | null;
	avatarUrl: string | null;
	followActivityId: string | null;
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

async function ensureFollowingStore(event: Pick<RequestEvent, 'platform'>) {
	const db = getDb(event);
	if (!db) return;

	await db
		.prepare(`ALTER TABLE ap_following ADD COLUMN summary TEXT`)
		.run()
		.catch(() => {});

	await db
		.prepare(`ALTER TABLE ap_following ADD COLUMN avatar_url TEXT`)
		.run()
		.catch(() => {});
}

function mapFollowing(row: FollowingRow | null | undefined): FollowingRecord | null {
	if (!row) return null;
	return {
		actorId: String(row.actor_id || ''),
		inboxUrl: getString(row.inbox_url),
		sharedInboxUrl: getString(row.shared_inbox_url),
		displayName: getString(row.display_name),
		handle: getString(row.handle),
		profileUrl: getString(row.profile_url),
		summary: getString(row.summary),
		avatarUrl: getString(row.avatar_url),
		followActivityId: getString(row.follow_activity_id)
	};
}

async function hydrateFollowingMetadata(
	event: Pick<RequestEvent, 'platform'>,
	record: FollowingRecord
): Promise<FollowingRecord> {
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
				`UPDATE ap_following
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

export function createFollowActivity(origin: string, targetActorId: string) {
	const actorId = getActorId(origin);
	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${actorId}/follows/${crypto.randomUUID()}`,
		type: 'Follow',
		actor: actorId,
		object: targetActorId
	};
}

export function createUndoActivity(origin: string, object: Record<string, unknown>) {
	const actorId = getActorId(origin);
	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${actorId}/undo/${crypto.randomUUID()}`,
		type: 'Undo',
		actor: actorId,
		object
	};
}

export async function listFollowing(event: Pick<RequestEvent, 'platform'>): Promise<FollowingRecord[]> {
	const db = getDb(event);
	if (!db) return [];
	await ensureFollowingStore(event);

	const result = await db
		.prepare(
			`SELECT actor_id, inbox_url, shared_inbox_url, display_name, handle, profile_url, summary, avatar_url, follow_activity_id
			 FROM ap_following
			 ORDER BY updated_at DESC`
		)
		.all<FollowingRow>();

	const records = (result.results || [])
		.map((row: FollowingRow) => mapFollowing(row))
		.filter((row: FollowingRecord | null): row is FollowingRecord => Boolean(row));

	return Promise.all(records.map((record: FollowingRecord) => hydrateFollowingMetadata(event, record)));
}

export async function listFollowingActorIds(
	event: Pick<RequestEvent, 'platform'>
): Promise<string[]> {
	const db = getDb(event);
	if (!db) return [];
	await ensureFollowingStore(event);

	const result = await db
		.prepare(
			`SELECT actor_id
			 FROM ap_following
			 ORDER BY updated_at DESC`
		)
		.all<FollowingRow>();

	return (result.results || [])
		.map((row: FollowingRow) => getString(row.actor_id))
		.filter((actorId: string | null): actorId is string => Boolean(actorId));
}

export async function countFollowing(event: Pick<RequestEvent, 'platform'>) {
	const db = getDb(event);
	if (!db) return 0;
	await ensureFollowingStore(event);

	const row = await db
		.prepare(`SELECT COUNT(*) AS following_count FROM ap_following`)
		.first<Record<string, unknown>>();

	return Number(row?.following_count || 0);
}

export async function getFollowingByActorId(
	event: Pick<RequestEvent, 'platform'>,
	actorId: string
): Promise<FollowingRecord | null> {
	const db = getDb(event);
	if (!db) return null;
	await ensureFollowingStore(event);

	const row = await db
		.prepare(
			`SELECT actor_id, inbox_url, shared_inbox_url, display_name, handle, profile_url, summary, avatar_url, follow_activity_id
			 FROM ap_following
			 WHERE actor_id = ?
			 LIMIT 1`
		)
		.bind(actorId)
		.first<FollowingRow>();

	return mapFollowing(row);
}

export async function followRemoteActor(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	actorIdOrProfile: string
) {
	const db = getDb(event);
	if (!db) throw new Error('D1 database is not configured');

	let actorId = actorIdOrProfile;
	if (!actorId.startsWith('http')) {
		throw new Error('Actor ID must be a URL');
	}

	const actor = await fetchRemoteActor(actorId);
	const activity = createFollowActivity(event.url.origin, actor.id);
	const inboxUrl = actor.sharedInboxUrl || actor.inboxUrl;
	await ensureFollowingStore(event);

	if (!inboxUrl) {
		throw new Error('Target actor does not expose an inbox');
	}

	await sendSignedActivity(event.url.origin, inboxUrl, activity);

	let profileUrl: string | null = null;
	let summary: string | null = null;
	let avatarUrl: string | null = null;
	try {
		const actorDoc = await fetchActivityJson(actor.id);
		profileUrl = getString(actorDoc.url);
		summary = getString(stripHtmlToText(String(actorDoc.summary || '')));
		const icon =
			actorDoc.icon && typeof actorDoc.icon === 'object'
				? (actorDoc.icon as Record<string, unknown>)
				: null;
		avatarUrl = getString(icon?.url);
	} catch {
		profileUrl = null;
		summary = null;
		avatarUrl = null;
	}

	await db
		.prepare(
			`INSERT INTO ap_following (
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
			actor.id,
			actor.inboxUrl,
			actor.sharedInboxUrl,
			actor.name,
			actor.handle,
			profileUrl,
			summary,
			avatarUrl,
			String(activity.id || '')
		)
		.run();

	return getFollowingByActorId(event, actor.id);
}

export async function unfollowRemoteActor(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	actorId: string
) {
	const db = getDb(event);
	if (!db) throw new Error('D1 database is not configured');

	const following = await getFollowingByActorId(event, actorId);
	if (!following) return;

	const inboxUrl = following.sharedInboxUrl || following.inboxUrl;
	if (inboxUrl && following.followActivityId) {
		await sendSignedActivity(
			event.url.origin,
			inboxUrl,
			createUndoActivity(event.url.origin, {
				id: following.followActivityId,
				type: 'Follow',
				actor: getActorId(event.url.origin),
				object: actorId
			})
		);
	}

	await db.prepare(`DELETE FROM ap_following WHERE actor_id = ?`).bind(actorId).run();
}
