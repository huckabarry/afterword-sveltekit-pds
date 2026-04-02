import type { RequestEvent } from '@sveltejs/kit';
import { type Checkin } from '$lib/server/atproto';

type CheckinSnapshotDb = NonNullable<App.Platform['env']['D1_DATABASE']>;

type StoredLatestCheckinRow = {
	id: number;
	visited_at: string;
	payload: string;
	updated_at: string;
};

type StoredLatestCheckinPayload = Omit<
	Checkin,
	'createdAt' | 'visitedAt'
> & {
	createdAt: string;
	visitedAt: string;
};

let latestCheckinSnapshotReady = false;
let latestCheckinSnapshotPromise: Promise<void> | null = null;

function getDatabase(event: Pick<RequestEvent, 'platform'>) {
	try {
		return (
			event.platform?.env?.D1_DATABASE ??
			event.platform?.env?.D1_DATABASE_BINDING ??
			event.platform?.env?.AP_DB ??
			null
		);
	} catch {
		return null;
	}
}

async function ensureLatestCheckinSnapshotSchema(db: CheckinSnapshotDb) {
	if (latestCheckinSnapshotReady) {
		return;
	}

	if (latestCheckinSnapshotPromise) {
		await latestCheckinSnapshotPromise;
		return;
	}

	latestCheckinSnapshotPromise = db
		.prepare(
			`CREATE TABLE IF NOT EXISTS latest_checkin_snapshot (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				visited_at TEXT NOT NULL,
				payload TEXT NOT NULL,
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`
		)
		.run()
		.then(() => {
			latestCheckinSnapshotReady = true;
		})
		.finally(() => {
			latestCheckinSnapshotPromise = null;
		});

	await latestCheckinSnapshotPromise;
}

function serializeCheckin(checkin: Checkin): StoredLatestCheckinPayload {
	return {
		...checkin,
		createdAt: checkin.createdAt.toISOString(),
		visitedAt: checkin.visitedAt.toISOString()
	};
}

function deserializeCheckin(payload: StoredLatestCheckinPayload): Checkin {
	return {
		...payload,
		createdAt: new Date(payload.createdAt),
		visitedAt: new Date(payload.visitedAt)
	};
}

export async function getLatestCheckinSnapshot(
	event: Pick<RequestEvent, 'platform'>
): Promise<Checkin | null> {
	const db = getDatabase(event);
	if (!db) {
		return null;
	}

	await ensureLatestCheckinSnapshotSchema(db);
	const row = await db
		.prepare(`SELECT id, visited_at, payload, updated_at FROM latest_checkin_snapshot WHERE id = 1`)
		.first<StoredLatestCheckinRow>();

	if (!row?.payload) {
		return null;
	}

	try {
		return deserializeCheckin(JSON.parse(row.payload) as StoredLatestCheckinPayload);
	} catch {
		return null;
	}
}

export async function upsertLatestCheckinSnapshot(
	event: Pick<RequestEvent, 'platform'>,
	checkin: Checkin
) {
	const db = getDatabase(event);
	if (!db) {
		return;
	}

	await ensureLatestCheckinSnapshotSchema(db);
	const existing = await db
		.prepare(`SELECT visited_at FROM latest_checkin_snapshot WHERE id = 1`)
		.first<{ visited_at?: string | null }>();

	const nextVisitedAt = checkin.visitedAt.toISOString();
	const existingVisitedAt = String(existing?.visited_at || '').trim();

	if (existingVisitedAt) {
		const existingTime = Date.parse(existingVisitedAt);
		const nextTime = Date.parse(nextVisitedAt);

		if (Number.isFinite(existingTime) && Number.isFinite(nextTime) && existingTime > nextTime) {
			return;
		}
	}

	await db
		.prepare(
			`INSERT INTO latest_checkin_snapshot (id, visited_at, payload, updated_at)
			VALUES (1, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(id) DO UPDATE SET
				visited_at = excluded.visited_at,
				payload = excluded.payload,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(nextVisitedAt, JSON.stringify(serializeCheckin(checkin)))
		.run();
}
