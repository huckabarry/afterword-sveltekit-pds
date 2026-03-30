import type { RequestEvent } from '@sveltejs/kit';

type MusicStatusDb = NonNullable<App.Platform['env']['D1_DATABASE']>;
type MusicStatusContext = Pick<RequestEvent, 'platform'> | null | undefined;

export type MusicCacheStatus = {
	lastAttemptedAt: string | null;
	lastRefreshedAt: string | null;
	lastStatus: 'idle' | 'success' | 'error';
	lastError: string | null;
	lastSource: 'r2' | 'pds' | 'archive' | null;
	archiveDigest: string | null;
};

function getDb(context: MusicStatusContext) {
	return (
		context?.platform?.env?.D1_DATABASE ?? context?.platform?.env?.D1_DATABASE_BINDING ?? null
	) as MusicStatusDb | null;
}

async function ensureMusicCacheStatusTable(db: MusicStatusDb) {
	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS music_cache_status (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				last_attempted_at TEXT,
				last_refreshed_at TEXT,
				last_status TEXT NOT NULL DEFAULT 'idle',
				last_error TEXT,
				last_source TEXT,
				archive_digest TEXT
			)`
		)
		.run();
}

export async function getMusicCacheStatus(context: MusicStatusContext): Promise<MusicCacheStatus> {
	const db = getDb(context);
	if (!db) {
		return {
			lastAttemptedAt: null,
			lastRefreshedAt: null,
			lastStatus: 'idle',
			lastError: null,
			lastSource: null,
			archiveDigest: null
		};
	}

	await ensureMusicCacheStatusTable(db);
	const row = await db
		.prepare(
			`SELECT
				last_attempted_at,
				last_refreshed_at,
				last_status,
				last_error,
				last_source,
				archive_digest
			FROM music_cache_status
			WHERE id = 1`
		)
		.first<{
			last_attempted_at?: string | null;
			last_refreshed_at?: string | null;
			last_status?: string | null;
			last_error?: string | null;
			last_source?: string | null;
			archive_digest?: string | null;
		}>();

	return {
		lastAttemptedAt: row?.last_attempted_at || null,
		lastRefreshedAt: row?.last_refreshed_at || null,
		lastStatus:
			row?.last_status === 'success' || row?.last_status === 'error'
				? row.last_status
				: 'idle',
		lastError: row?.last_error || null,
		lastSource:
			row?.last_source === 'r2' || row?.last_source === 'pds' || row?.last_source === 'archive'
				? row.last_source
				: null,
		archiveDigest: row?.archive_digest || null
	};
}

export async function updateMusicCacheStatus(
	context: MusicStatusContext,
	status: Partial<MusicCacheStatus> & { lastAttemptedAt?: string | null }
) {
	const db = getDb(context);
	if (!db) {
		return;
	}

	await ensureMusicCacheStatusTable(db);
	const current = await getMusicCacheStatus(context);

	await db
		.prepare(
			`INSERT INTO music_cache_status (
				id,
				last_attempted_at,
				last_refreshed_at,
				last_status,
				last_error,
				last_source,
				archive_digest
			)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				last_attempted_at = excluded.last_attempted_at,
				last_refreshed_at = excluded.last_refreshed_at,
				last_status = excluded.last_status,
				last_error = excluded.last_error,
				last_source = excluded.last_source,
				archive_digest = excluded.archive_digest`
		)
		.bind(
			1,
			status.lastAttemptedAt ?? current.lastAttemptedAt,
			status.lastRefreshedAt ?? current.lastRefreshedAt,
			status.lastStatus ?? current.lastStatus,
			status.lastError ?? current.lastError,
			status.lastSource ?? current.lastSource,
			status.archiveDigest ?? current.archiveDigest
		)
		.run();
}
