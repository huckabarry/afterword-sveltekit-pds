import type { RequestEvent } from '@sveltejs/kit';

type StateRow = Record<string, unknown>;

function getDb(event: Pick<RequestEvent, 'platform'>) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

let ensuredTables: Promise<void> | null = null;

async function ensureTables(event: Pick<RequestEvent, 'platform'>) {
	const db = getDb(event);
	if (!db) return;

	if (!ensuredTables) {
		ensuredTables = (async () => {
			await db
				.prepare(
					`CREATE TABLE IF NOT EXISTS mastodon_favourites (
						object_id TEXT PRIMARY KEY,
						activity_id TEXT,
						created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
					)`
				)
				.run();
			await db
				.prepare(
					`CREATE TABLE IF NOT EXISTS mastodon_bookmarks (
						object_id TEXT PRIMARY KEY,
						created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
					)`
				)
				.run();
			await db
				.prepare(
					`CREATE TABLE IF NOT EXISTS mastodon_reblogs (
						object_id TEXT PRIMARY KEY,
						activity_id TEXT,
						created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
					)`
				)
				.run();
			await db
				.prepare(
					`CREATE TABLE IF NOT EXISTS mastodon_mutes (
						actor_id TEXT PRIMARY KEY,
						notifications INTEGER NOT NULL DEFAULT 0,
						created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
					)`
				)
				.run();
			await db
				.prepare(
					`CREATE TABLE IF NOT EXISTS mastodon_blocks (
						actor_id TEXT PRIMARY KEY,
						created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
					)`
				)
				.run();
		})().catch((error) => {
			ensuredTables = null;
			throw error;
		});
	}

	await ensuredTables;
}

async function hasRow(
	event: Pick<RequestEvent, 'platform'>,
	table: string,
	column: 'object_id' | 'actor_id',
	value: string
) {
	const db = getDb(event);
	if (!db) return false;
	await ensureTables(event);

	const row = await db
		.prepare(`SELECT ${column} FROM ${table} WHERE ${column} = ? LIMIT 1`)
		.bind(value)
		.first<StateRow>();

	return Boolean(row?.[column]);
}

async function getActivityId(
	event: Pick<RequestEvent, 'platform'>,
	table: 'mastodon_favourites' | 'mastodon_reblogs',
	objectId: string
) {
	const db = getDb(event);
	if (!db) return null;
	await ensureTables(event);

	const row = await db
		.prepare(`SELECT activity_id FROM ${table} WHERE object_id = ? LIMIT 1`)
		.bind(objectId)
		.first<StateRow>();

	return row?.activity_id ? String(row.activity_id) : null;
}

async function upsertObjectState(
	event: Pick<RequestEvent, 'platform'>,
	table: 'mastodon_favourites' | 'mastodon_bookmarks' | 'mastodon_reblogs',
	objectId: string,
	activityId?: string | null
) {
	const db = getDb(event);
	if (!db) throw new Error('D1 database is not configured');
	await ensureTables(event);

	if (table === 'mastodon_bookmarks') {
		await db
			.prepare(
				`INSERT INTO mastodon_bookmarks (object_id)
				 VALUES (?)
				 ON CONFLICT(object_id) DO NOTHING`
			)
			.bind(objectId)
			.run();
		return;
	}

	await db
		.prepare(
			`INSERT INTO ${table} (object_id, activity_id)
			 VALUES (?, ?)
			 ON CONFLICT(object_id) DO UPDATE SET activity_id = excluded.activity_id`
		)
		.bind(objectId, activityId ?? null)
		.run();
}

async function deleteObjectState(
	event: Pick<RequestEvent, 'platform'>,
	table: 'mastodon_favourites' | 'mastodon_bookmarks' | 'mastodon_reblogs',
	objectId: string
) {
	const db = getDb(event);
	if (!db) throw new Error('D1 database is not configured');
	await ensureTables(event);
	await db.prepare(`DELETE FROM ${table} WHERE object_id = ?`).bind(objectId).run();
}

async function listObjectIds(
	event: Pick<RequestEvent, 'platform'>,
	table: 'mastodon_favourites' | 'mastodon_bookmarks' | 'mastodon_reblogs',
	limit = 40
) {
	const db = getDb(event);
	if (!db) return [];
	await ensureTables(event);

	const result = await db
		.prepare(`SELECT object_id FROM ${table} ORDER BY created_at DESC LIMIT ?`)
		.bind(Math.max(1, Math.min(limit, 200)))
		.all<StateRow>();

	return (result.results || [])
		.map((row: StateRow) => (row.object_id ? String(row.object_id) : null))
		.filter((row: string | null): row is string => Boolean(row));
}

async function upsertActorState(
	event: Pick<RequestEvent, 'platform'>,
	table: 'mastodon_mutes' | 'mastodon_blocks',
	actorId: string,
	options?: { notifications?: boolean }
) {
	const db = getDb(event);
	if (!db) throw new Error('D1 database is not configured');
	await ensureTables(event);

	if (table === 'mastodon_mutes') {
		await db
			.prepare(
				`INSERT INTO mastodon_mutes (actor_id, notifications)
				 VALUES (?, ?)
				 ON CONFLICT(actor_id) DO UPDATE SET notifications = excluded.notifications`
			)
			.bind(actorId, options?.notifications ? 1 : 0)
			.run();
		return;
	}

	await db
		.prepare(
			`INSERT INTO mastodon_blocks (actor_id)
			 VALUES (?)
			 ON CONFLICT(actor_id) DO NOTHING`
		)
		.bind(actorId)
		.run();
}

async function deleteActorState(
	event: Pick<RequestEvent, 'platform'>,
	table: 'mastodon_mutes' | 'mastodon_blocks',
	actorId: string
) {
	const db = getDb(event);
	if (!db) throw new Error('D1 database is not configured');
	await ensureTables(event);
	await db.prepare(`DELETE FROM ${table} WHERE actor_id = ?`).bind(actorId).run();
}

async function listActorIds(
	event: Pick<RequestEvent, 'platform'>,
	table: 'mastodon_mutes' | 'mastodon_blocks',
	limit = 40
) {
	const db = getDb(event);
	if (!db) return [];
	await ensureTables(event);

	const result = await db
		.prepare(`SELECT actor_id FROM ${table} ORDER BY created_at DESC LIMIT ?`)
		.bind(Math.max(1, Math.min(limit, 200)))
		.all<StateRow>();

	return (result.results || [])
		.map((row: StateRow) => (row.actor_id ? String(row.actor_id) : null))
		.filter((row: string | null): row is string => Boolean(row));
}

export async function isObjectFavourited(event: Pick<RequestEvent, 'platform'>, objectId: string) {
	return hasRow(event, 'mastodon_favourites', 'object_id', objectId);
}

export async function getFavouriteActivityId(event: Pick<RequestEvent, 'platform'>, objectId: string) {
	return getActivityId(event, 'mastodon_favourites', objectId);
}

export async function favouriteObject(
	event: Pick<RequestEvent, 'platform'>,
	input: { objectId: string; activityId?: string | null }
) {
	return upsertObjectState(event, 'mastodon_favourites', input.objectId, input.activityId);
}

export async function unfavouriteObject(event: Pick<RequestEvent, 'platform'>, objectId: string) {
	return deleteObjectState(event, 'mastodon_favourites', objectId);
}

export async function listFavouritedObjectIds(event: Pick<RequestEvent, 'platform'>, limit = 40) {
	return listObjectIds(event, 'mastodon_favourites', limit);
}

export async function isObjectBookmarked(event: Pick<RequestEvent, 'platform'>, objectId: string) {
	return hasRow(event, 'mastodon_bookmarks', 'object_id', objectId);
}

export async function bookmarkObject(event: Pick<RequestEvent, 'platform'>, objectId: string) {
	return upsertObjectState(event, 'mastodon_bookmarks', objectId);
}

export async function unbookmarkObject(event: Pick<RequestEvent, 'platform'>, objectId: string) {
	return deleteObjectState(event, 'mastodon_bookmarks', objectId);
}

export async function listBookmarkedObjectIds(event: Pick<RequestEvent, 'platform'>, limit = 40) {
	return listObjectIds(event, 'mastodon_bookmarks', limit);
}

export async function isObjectReblogged(event: Pick<RequestEvent, 'platform'>, objectId: string) {
	return hasRow(event, 'mastodon_reblogs', 'object_id', objectId);
}

export async function getReblogActivityId(event: Pick<RequestEvent, 'platform'>, objectId: string) {
	return getActivityId(event, 'mastodon_reblogs', objectId);
}

export async function reblogObject(
	event: Pick<RequestEvent, 'platform'>,
	input: { objectId: string; activityId?: string | null }
) {
	return upsertObjectState(event, 'mastodon_reblogs', input.objectId, input.activityId);
}

export async function unreblogObject(event: Pick<RequestEvent, 'platform'>, objectId: string) {
	return deleteObjectState(event, 'mastodon_reblogs', objectId);
}

export async function isActorMuted(event: Pick<RequestEvent, 'platform'>, actorId: string) {
	return hasRow(event, 'mastodon_mutes', 'actor_id', actorId);
}

export async function muteActor(
	event: Pick<RequestEvent, 'platform'>,
	actorId: string,
	options?: { notifications?: boolean }
) {
	return upsertActorState(event, 'mastodon_mutes', actorId, options);
}

export async function unmuteActor(event: Pick<RequestEvent, 'platform'>, actorId: string) {
	return deleteActorState(event, 'mastodon_mutes', actorId);
}

export async function listMutedActorIds(event: Pick<RequestEvent, 'platform'>, limit = 40) {
	return listActorIds(event, 'mastodon_mutes', limit);
}

export async function isActorBlocked(event: Pick<RequestEvent, 'platform'>, actorId: string) {
	return hasRow(event, 'mastodon_blocks', 'actor_id', actorId);
}

export async function blockActor(event: Pick<RequestEvent, 'platform'>, actorId: string) {
	return upsertActorState(event, 'mastodon_blocks', actorId);
}

export async function unblockActor(event: Pick<RequestEvent, 'platform'>, actorId: string) {
	return deleteActorState(event, 'mastodon_blocks', actorId);
}

export async function listBlockedActorIds(event: Pick<RequestEvent, 'platform'>, limit = 40) {
	return listActorIds(event, 'mastodon_blocks', limit);
}
