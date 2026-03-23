import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

type DbEvent = Pick<RequestEvent, 'platform'>;

export type MastodonApp = {
	id: number;
	clientName: string;
	redirectUris: string;
	scopes: string;
	website: string | null;
	clientId: string;
	clientSecret: string;
};

function getDb(event: DbEvent) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

function getAdminPassword() {
	return String(env.MASTODON_ADMIN_PASSWORD || '').trim();
}

function base64Url(bytes: Uint8Array) {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function randomToken(bytes = 32) {
	const buffer = new Uint8Array(bytes);
	crypto.getRandomValues(buffer);
	return base64Url(buffer);
}

function requireDb(event: DbEvent) {
	const db = getDb(event);
	if (!db) {
		throw error(500, 'D1 database is not configured');
	}
	return db;
}

export async function registerClientApp(
	event: DbEvent,
	input: {
		clientName: string;
		redirectUris: string;
		scopes: string;
		website?: string | null;
	}
) {
	const db = requireDb(event);
	const clientId = await randomToken(24);
	const clientSecret = await randomToken(36);

	const result = await db
		.prepare(
			`INSERT INTO mastodon_apps (
				client_name, redirect_uris, scopes, website, client_id, client_secret
			) VALUES (?, ?, ?, ?, ?, ?)
			RETURNING id`
		)
		.bind(
			input.clientName,
			input.redirectUris,
			input.scopes,
			input.website ?? null,
			clientId,
			clientSecret
		)
		.first<Record<string, unknown>>();

	return {
		id: Number(result?.id || 0),
		clientId,
		clientSecret
	};
}

export async function getClientAppByCredentials(
	event: DbEvent,
	clientId: string,
	clientSecret?: string | null
): Promise<MastodonApp | null> {
	const db = requireDb(event);
	const row = await db
		.prepare(
			`SELECT id, client_name, redirect_uris, scopes, website, client_id, client_secret
			 FROM mastodon_apps
			 WHERE client_id = ?`
		)
		.bind(clientId)
		.first<Record<string, unknown>>();

	if (!row) return null;
	if (clientSecret != null && String(row.client_secret || '') !== clientSecret) return null;

	return {
		id: Number(row.id || 0),
		clientName: String(row.client_name || ''),
		redirectUris: String(row.redirect_uris || ''),
		scopes: String(row.scopes || ''),
		website: row.website ? String(row.website) : null,
		clientId: String(row.client_id || ''),
		clientSecret: String(row.client_secret || '')
	};
}

export async function createAuthorizationCode(
	event: DbEvent,
	input: {
		appId: number;
		redirectUri: string;
		scopes: string;
	}
) {
	const db = requireDb(event);
	const code = await randomToken(24);
	const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

	await db
		.prepare(
			`INSERT INTO mastodon_auth_codes (
				code, app_id, redirect_uri, scopes, expires_at
			) VALUES (?, ?, ?, ?, ?)`
		)
		.bind(code, input.appId, input.redirectUri, input.scopes, expiresAt)
		.run();

	return code;
}

export async function exchangeAuthorizationCode(
	event: DbEvent,
	input: {
		clientId: string;
		clientSecret: string;
		code: string;
		redirectUri: string;
	}
) {
	const db = requireDb(event);
	const app = await getClientAppByCredentials(event, input.clientId, input.clientSecret);
	if (!app) {
		throw error(401, 'Invalid client credentials');
	}

	const row = await db
		.prepare(
			`SELECT code, app_id, redirect_uri, scopes, expires_at, used_at
			 FROM mastodon_auth_codes
			 WHERE code = ?`
		)
		.bind(input.code)
		.first<Record<string, unknown>>();

	if (!row) {
		throw error(401, 'Invalid authorization code');
	}

	if (Number(row.app_id || 0) !== app.id || String(row.redirect_uri || '') !== input.redirectUri) {
		throw error(401, 'Authorization code does not match app');
	}

	if (row.used_at) {
		throw error(401, 'Authorization code already used');
	}

	if (new Date(String(row.expires_at || '')).getTime() < Date.now()) {
		throw error(401, 'Authorization code expired');
	}

	const token = await randomToken(36);
	await db.batch([
		db.prepare(
			`UPDATE mastodon_auth_codes SET used_at = CURRENT_TIMESTAMP WHERE code = ?`
		).bind(input.code),
		db.prepare(
			`INSERT INTO mastodon_access_tokens (token, app_id, scopes) VALUES (?, ?, ?)`
		).bind(token, app.id, String(row.scopes || 'read write'))
	]);

	return {
		accessToken: token,
		scope: String(row.scopes || 'read write')
	};
}

export async function requireAccessToken(event: RequestEvent) {
	const db = requireDb(event);
	const auth = event.request.headers.get('authorization') || '';
	const match = auth.match(/^Bearer\s+(.+)$/i);
	const token = match?.[1]?.trim();

	if (!token) {
		throw error(401, 'Missing access token');
	}

	const row = await db
		.prepare(
			`SELECT token, app_id, scopes
			 FROM mastodon_access_tokens
			 WHERE token = ?`
		)
		.bind(token)
		.first<Record<string, unknown>>();

	if (!row) {
		throw error(401, 'Invalid access token');
	}

	await db
		.prepare(`UPDATE mastodon_access_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token = ?`)
		.bind(token)
		.run();

	return {
		token: String(row.token || ''),
		appId: Number(row.app_id || 0),
		scopes: String(row.scopes || '')
	};
}

export function validateAdminPassword(password: string) {
	const expected = getAdminPassword();
	return Boolean(expected) && password === expected;
}

export function requireAdminPasswordConfigured() {
	if (!getAdminPassword()) {
		throw error(500, 'MASTODON_ADMIN_PASSWORD is not configured');
	}
}
