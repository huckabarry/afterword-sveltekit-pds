import type { RequestEvent } from '@sveltejs/kit';

type FavouriteRow = Record<string, unknown>;

function getDb(event: Pick<RequestEvent, 'platform'>) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

export async function isObjectFavourited(
	event: Pick<RequestEvent, 'platform'>,
	objectId: string
) {
	const db = getDb(event);
	if (!db) return false;

	const row = await db
		.prepare(`SELECT object_id FROM mastodon_favourites WHERE object_id = ? LIMIT 1`)
		.bind(objectId)
		.first<FavouriteRow>();

	return Boolean(row?.object_id);
}

export async function getFavouriteActivityId(
	event: Pick<RequestEvent, 'platform'>,
	objectId: string
) {
	const db = getDb(event);
	if (!db) return null;

	const row = await db
		.prepare(`SELECT activity_id FROM mastodon_favourites WHERE object_id = ? LIMIT 1`)
		.bind(objectId)
		.first<FavouriteRow>();

	return row?.activity_id ? String(row.activity_id) : null;
}

export async function favouriteObject(
	event: Pick<RequestEvent, 'platform'>,
	input: { objectId: string; activityId?: string | null }
) {
	const db = getDb(event);
	if (!db) throw new Error('D1 database is not configured');

	await db
		.prepare(
			`INSERT INTO mastodon_favourites (object_id, activity_id)
			 VALUES (?, ?)
			 ON CONFLICT(object_id) DO UPDATE SET
			 	activity_id = excluded.activity_id`
		)
		.bind(input.objectId, input.activityId ?? null)
		.run();
}

export async function unfavouriteObject(
	event: Pick<RequestEvent, 'platform'>,
	objectId: string
) {
	const db = getDb(event);
	if (!db) throw new Error('D1 database is not configured');

	await db.prepare(`DELETE FROM mastodon_favourites WHERE object_id = ?`).bind(objectId).run();
}
