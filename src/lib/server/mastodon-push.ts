import type { RequestEvent } from '@sveltejs/kit';

type Row = Record<string, unknown>;

function getDb(event: Pick<RequestEvent, 'platform'>) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

let ensuredTable: Promise<void> | null = null;

async function ensureTable(event: Pick<RequestEvent, 'platform'>) {
	const db = getDb(event);
	if (!db) return;

	if (!ensuredTable) {
		ensuredTable = db
			.prepare(
				`CREATE TABLE IF NOT EXISTS mastodon_push_subscriptions (
					token TEXT PRIMARY KEY,
					endpoint TEXT NOT NULL,
					key_auth TEXT NOT NULL,
					key_p256dh TEXT NOT NULL,
					alerts_json TEXT NOT NULL,
					policy TEXT NOT NULL DEFAULT 'all',
					server_key TEXT,
					updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
				)`
			)
			.run()
			.then(() => undefined)
			.catch((error: unknown) => {
				ensuredTable = null;
				throw error;
			});
	}

	await ensuredTable;
}

function normalizeAlerts(input: Record<string, unknown> | null | undefined) {
	const source = input || {};
	const getBoolean = (key: string) => Boolean(source[key]);

	return {
		follow: getBoolean('follow'),
		follow_request: getBoolean('follow_request'),
		favourite: getBoolean('favourite'),
		mention: getBoolean('mention'),
		reblog: getBoolean('reblog'),
		poll: getBoolean('poll'),
		status: getBoolean('status'),
		update: getBoolean('update'),
		'admin.sign_up': getBoolean('admin.sign_up'),
		'admin.report': getBoolean('admin.report'),
		'pending.favourite': getBoolean('pending.favourite'),
		'pending.reply': getBoolean('pending.reply'),
		'pending.reblog': getBoolean('pending.reblog')
	};
}

export function normalizePushPayload(input: {
	endpoint?: string | null;
	auth?: string | null;
	p256dh?: string | null;
	policy?: string | null;
	alerts?: Record<string, unknown> | null;
	serverKey?: string | null;
}) {
	return {
		endpoint: String(input.endpoint || '').trim(),
		auth: String(input.auth || '').trim(),
		p256dh: String(input.p256dh || '').trim(),
		policy: String(input.policy || 'all').trim() || 'all',
		alerts: normalizeAlerts(input.alerts),
		serverKey: input.serverKey ? String(input.serverKey).trim() : null
	};
}

export async function getPushSubscription(
	event: Pick<RequestEvent, 'platform'>,
	token: string
) {
	const db = getDb(event);
	if (!db) return null;
	await ensureTable(event);

	const row = await db
		.prepare(
			`SELECT endpoint, key_auth, key_p256dh, alerts_json, policy, server_key
			 FROM mastodon_push_subscriptions
			 WHERE token = ?
			 LIMIT 1`
		)
		.bind(token)
		.first<Row>();

	if (!row) return null;

	let alerts: Record<string, unknown> = {};
	try {
		alerts = JSON.parse(String(row.alerts_json || '{}'));
	} catch {}

	return {
		id: `push:${token.slice(0, 12)}`,
		endpoint: String(row.endpoint || ''),
		server_key: row.server_key ? String(row.server_key) : null,
		alerts,
		policy: String(row.policy || 'all'),
		subscription: {
			endpoint: String(row.endpoint || ''),
			keys: {
				auth: String(row.key_auth || ''),
				p256dh: String(row.key_p256dh || '')
			}
		}
	};
}

export async function upsertPushSubscription(
	event: Pick<RequestEvent, 'platform'>,
	token: string,
	input: ReturnType<typeof normalizePushPayload>
) {
	const db = getDb(event);
	if (!db) throw new Error('D1 database is not configured');
	await ensureTable(event);

	await db
		.prepare(
			`INSERT INTO mastodon_push_subscriptions (
				token, endpoint, key_auth, key_p256dh, alerts_json, policy, server_key, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(token) DO UPDATE SET
				endpoint = excluded.endpoint,
				key_auth = excluded.key_auth,
				key_p256dh = excluded.key_p256dh,
				alerts_json = excluded.alerts_json,
				policy = excluded.policy,
				server_key = excluded.server_key,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			token,
			input.endpoint,
			input.auth,
			input.p256dh,
			JSON.stringify(input.alerts),
			input.policy,
			input.serverKey
		)
		.run();

	return getPushSubscription(event, token);
}

export async function deletePushSubscription(
	event: Pick<RequestEvent, 'platform'>,
	token: string
) {
	const db = getDb(event);
	if (!db) return;
	await ensureTable(event);
	await db.prepare(`DELETE FROM mastodon_push_subscriptions WHERE token = ?`).bind(token).run();
}
