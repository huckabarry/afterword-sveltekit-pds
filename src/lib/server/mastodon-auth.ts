import { error, type RequestEvent } from '@sveltejs/kit';
import { createAdminSession, getAdminPassword, hasAdminSession } from '$lib/server/admin';

type MastodonAppRow = Record<string, unknown>;
type AccessTokenRow = Record<string, unknown>;

export type MastodonApp = {
	name: string;
	website: string | null;
	redirectUris: string[];
	scopes: string;
	clientId: string;
	clientSecret: string;
};

export type MastodonAccessToken = {
	token: string;
	clientId: string;
	scope: string;
	createdAt: string;
};

function getDb(event: Pick<RequestEvent, 'platform'>) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

function randomToken(size = 32) {
	const bytes = crypto.getRandomValues(new Uint8Array(size));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseRedirectUris(value: string) {
	return String(value || '')
		.split(/\s+/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function mapApp(row: MastodonAppRow | null | undefined): MastodonApp | null {
	if (!row) return null;

	return {
		name: String(row.name || ''),
		website: row.website ? String(row.website) : null,
		redirectUris: parseRedirectUris(String(row.redirect_uris || '')),
		scopes: String(row.scopes || 'read write'),
		clientId: String(row.client_id || ''),
		clientSecret: String(row.client_secret || '')
	};
}

function mapAccessToken(row: AccessTokenRow | null | undefined): MastodonAccessToken | null {
	if (!row) return null;

	return {
		token: String(row.token || ''),
		clientId: String(row.client_id || ''),
		scope: String(row.scope || ''),
		createdAt: String(row.created_at || '')
	};
}

export async function createMastodonApp(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		name: string;
		redirectUris: string[];
		scopes: string;
		website?: string | null;
	}
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	const clientId = `afterword-${randomToken(12)}`;
	const clientSecret = randomToken(24);
	const redirectUris = input.redirectUris.join(' ');

	await db
		.prepare(
			`INSERT INTO mastodon_apps (
				name, website, redirect_uris, scopes, client_id, client_secret
			) VALUES (?, ?, ?, ?, ?, ?)`
		)
		.bind(
			String(input.name || 'Afterword App').trim(),
			input.website ? String(input.website).trim() : null,
			redirectUris,
			String(input.scopes || 'read write').trim() || 'read write',
			clientId,
			clientSecret
		)
		.run();

	return {
		clientId,
		clientSecret
	};
}

export async function getMastodonAppByClientId(
	event: Pick<RequestEvent, 'platform'>,
	clientId: string
) {
	const db = getDb(event);
	if (!db) return null;

	const row = await db
		.prepare(
			`SELECT name, website, redirect_uris, scopes, client_id, client_secret
			 FROM mastodon_apps
			 WHERE client_id = ?
			 LIMIT 1`
		)
		.bind(clientId)
		.first<MastodonAppRow>();

	return mapApp(row);
}

export function redirectUriAllowed(app: MastodonApp, redirectUri: string) {
	return app.redirectUris.includes(redirectUri);
}

export async function createAuthorizationCode(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		clientId: string;
		redirectUri: string;
		scope: string;
	}
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	const code = randomToken(18);
	const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

	await db
		.prepare(
			`INSERT INTO mastodon_oauth_codes (
				code, client_id, redirect_uri, scope, expires_at
			) VALUES (?, ?, ?, ?, ?)`
		)
		.bind(code, input.clientId, input.redirectUri, input.scope, expiresAt)
		.run();

	return code;
}

export async function consumeAuthorizationCode(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		code: string;
		clientId: string;
		redirectUri: string;
	}
) {
	const db = getDb(event);
	if (!db) return null;

	const row = await db
		.prepare(
			`SELECT code, client_id, redirect_uri, scope, expires_at, used_at
			 FROM mastodon_oauth_codes
			 WHERE code = ?
			 LIMIT 1`
		)
		.bind(input.code)
		.first<Record<string, unknown>>();

	if (!row) return null;
	if (String(row.client_id || '') !== input.clientId) return null;
	if (String(row.redirect_uri || '') !== input.redirectUri) return null;
	if (row.used_at) return null;
	if (Date.parse(String(row.expires_at || '')) < Date.now()) return null;

	await db
		.prepare(`UPDATE mastodon_oauth_codes SET used_at = CURRENT_TIMESTAMP WHERE code = ?`)
		.bind(input.code)
		.run();

	return {
		scope: String(row.scope || 'read write')
	};
}

export async function createAccessToken(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		clientId: string;
		scope: string;
	}
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	const token = randomToken(24);

	await db
		.prepare(
			`INSERT INTO mastodon_access_tokens (token, client_id, scope)
			 VALUES (?, ?, ?)`
		)
		.bind(token, input.clientId, input.scope)
		.run();

	return token;
}

export async function getAccessToken(
	event: Pick<RequestEvent, 'platform'>,
	token: string
) {
	const db = getDb(event);
	if (!db) return null;

	const row = await db
		.prepare(
			`SELECT token, client_id, scope, created_at
			 FROM mastodon_access_tokens
			 WHERE token = ?
			 LIMIT 1`
		)
		.bind(token)
		.first<AccessTokenRow>();

	if (!row) return null;

	await db
		.prepare(`UPDATE mastodon_access_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token = ?`)
		.bind(token)
		.run();

	return mapAccessToken(row);
}

function getBearerToken(event: Pick<RequestEvent, 'request'>) {
	const header = event.request.headers.get('authorization')?.trim() || '';
	if (!header.toLowerCase().startsWith('bearer ')) return '';
	return header.slice(7).trim();
}

export async function requireMastodonAccessToken(event: Pick<RequestEvent, 'platform' | 'request'>) {
	const token = getBearerToken(event);
	if (!token) {
		throw error(401, 'Missing access token');
	}

	const accessToken = await getAccessToken(event, token);
	if (!accessToken) {
		throw error(401, 'Invalid access token');
	}

	return accessToken;
}

export async function isAuthorizedAdmin(event: Pick<RequestEvent, 'cookies' | 'request'>) {
	if (await hasAdminSession(event.cookies)) {
		return true;
	}

	const submittedPassword = String((await event.request.formData().catch(() => null))?.get('password') || '').trim();
	const password = getAdminPassword();
	if (!password || submittedPassword !== password) {
		return false;
	}

	await createAdminSession(event.cookies);
	return true;
}
