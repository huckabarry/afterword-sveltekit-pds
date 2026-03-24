import { error, type RequestEvent } from '@sveltejs/kit';
import { createAdminSession, getAdminPassword, hasAdminSession } from '$lib/server/admin';

type MastodonAppRow = Record<string, unknown>;
type AccessTokenRow = Record<string, unknown>;

export type MastodonApp = {
	id: number;
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

function base64UrlEncode(value: string) {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(value, 'utf8').toString('base64url');
	}

	return btoa(unescape(encodeURIComponent(value)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(value, 'base64url').toString('utf8');
	}

	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	return decodeURIComponent(escape(atob(normalized)));
}

async function sha256Hex(value: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseRedirectUris(value: string) {
	return String(value || '')
		.split(/\s+/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function normalizeRedirectUri(value: string) {
	const trimmed = String(value || '').trim();
	if (!trimmed) return '';

	try {
		const url = new URL(trimmed);
		const pathname = url.pathname !== '/' ? url.pathname.replace(/\/+$/, '') || '/' : '/';
		return `${url.protocol}//${url.host}${pathname}${url.search}`;
	} catch {
		return trimmed.replace(/\/+$/, '');
	}
}

function getMastodonClientSecretSeed() {
	return getAdminPassword() || 'afterword-mastodon-oauth';
}

async function buildStatelessAppCredentials(input: {
	name: string;
	redirectUris: string[];
	scopes: string;
	website?: string | null;
}) {
	const payload = {
		n: String(input.name || 'Afterword App').trim(),
		r: input.redirectUris.map((uri) => normalizeRedirectUri(uri)).filter(Boolean),
		s: String(input.scopes || 'read write').trim() || 'read write',
		w: input.website ? String(input.website).trim() : null
	};
	const encoded = base64UrlEncode(JSON.stringify(payload));
	const signature = (await sha256Hex(`${getMastodonClientSecretSeed()}:mastodon-app:${encoded}`)).slice(0, 24);
	const clientId = `afterword.${encoded}.${signature}`;
	const clientSecret = await sha256Hex(`${getMastodonClientSecretSeed()}:mastodon-secret:${encoded}`);

	return {
		clientId,
		clientSecret,
		name: payload.n,
		redirectUris: payload.r,
		scopes: payload.s,
		website: payload.w
	};
}

async function decodeStatelessApp(clientId: string) {
	const parts = String(clientId || '').trim().split('.');
	if (parts.length !== 3 || parts[0] !== 'afterword') return null;

	const encoded = parts[1];
	const signature = parts[2];
	const expected = (await sha256Hex(`${getMastodonClientSecretSeed()}:mastodon-app:${encoded}`)).slice(0, 24);
	if (signature !== expected) return null;

	try {
		const payload = JSON.parse(base64UrlDecode(encoded)) as {
			n?: string;
			r?: string[];
			s?: string;
			w?: string | null;
		};

		const redirectUris = Array.isArray(payload.r)
			? payload.r.map((uri) => normalizeRedirectUri(uri)).filter(Boolean)
			: [];
		if (!redirectUris.length) return null;

		return {
			id: 0,
			name: String(payload.n || 'Afterword App'),
			website: payload.w ? String(payload.w) : null,
			redirectUris,
			scopes: String(payload.s || 'read write'),
			clientId,
			clientSecret: await sha256Hex(`${getMastodonClientSecretSeed()}:mastodon-secret:${encoded}`)
		} satisfies MastodonApp;
	} catch {
		return null;
	}
}

async function persistMastodonApp(
	event: Pick<RequestEvent, 'platform'>,
	app: Omit<MastodonApp, 'id'>
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	await db
		.prepare(
			`INSERT INTO mastodon_apps (
				client_name, redirect_uris, scopes, website, client_id, client_secret
			) VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(client_id) DO UPDATE SET
				client_name = excluded.client_name,
				redirect_uris = excluded.redirect_uris,
				scopes = excluded.scopes,
				website = excluded.website,
				client_secret = excluded.client_secret`
		)
		.bind(
			app.name,
			app.redirectUris.join(' '),
			app.scopes,
			app.website,
			app.clientId,
			app.clientSecret
		)
		.run();

	const row = await db
		.prepare(
			`SELECT id, client_name, website, redirect_uris, scopes, client_id, client_secret
			 FROM mastodon_apps
			 WHERE client_id = ?
			 LIMIT 1`
		)
		.bind(app.clientId)
		.first<MastodonAppRow>();

	return mapApp(row);
}

function mapApp(row: MastodonAppRow | null | undefined): MastodonApp | null {
	if (!row) return null;

	return {
		id: Number(row.id || 0),
		name: String(row.client_name || ''),
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
		scope: String(row.scopes || ''),
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

	const credentials = await buildStatelessAppCredentials(input);
	await persistMastodonApp(event, {
		name: credentials.name,
		redirectUris: credentials.redirectUris,
		scopes: credentials.scopes,
		website: credentials.website,
		clientId: credentials.clientId,
		clientSecret: credentials.clientSecret
	});

	return {
		clientId: credentials.clientId,
		clientSecret: credentials.clientSecret
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
			`SELECT id, client_name, website, redirect_uris, scopes, client_id, client_secret
			 FROM mastodon_apps
			 WHERE client_id = ?
			 LIMIT 1`
		)
		.bind(clientId)
		.first<MastodonAppRow>();

	const app = mapApp(row);
	if (app) return app;

	const stateless = await decodeStatelessApp(clientId);
	if (!stateless) return null;

	return persistMastodonApp(event, {
		name: stateless.name,
		redirectUris: stateless.redirectUris,
		scopes: stateless.scopes,
		website: stateless.website,
		clientId: stateless.clientId,
		clientSecret: stateless.clientSecret
	});
}

export function redirectUriAllowed(app: MastodonApp, redirectUri: string) {
	const requested = normalizeRedirectUri(redirectUri);
	if (!requested) return false;

	return app.redirectUris.some((allowed) => normalizeRedirectUri(allowed) === requested);
}

export async function createAuthorizationCode(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		appId: number;
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
			`INSERT INTO mastodon_auth_codes (
				code, app_id, redirect_uri, scopes, expires_at
			) VALUES (?, ?, ?, ?, ?)`
		)
		.bind(code, input.appId, input.redirectUri, input.scope, expiresAt)
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
			`SELECT c.code, c.redirect_uri, c.scopes, c.expires_at, c.used_at, a.client_id
			 FROM mastodon_auth_codes c
			 JOIN mastodon_apps a ON a.id = c.app_id
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
		.prepare(`UPDATE mastodon_auth_codes SET used_at = CURRENT_TIMESTAMP WHERE code = ?`)
		.bind(input.code)
		.run();

	return {
		scope: String(row.scopes || 'read write')
	};
}

export async function createAccessToken(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		appId: number;
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
			`INSERT INTO mastodon_access_tokens (token, app_id, scopes)
			 VALUES (?, ?, ?)`
		)
		.bind(token, input.appId, input.scope)
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
			`SELECT t.token, t.scopes, t.created_at, a.client_id
			 FROM mastodon_access_tokens t
			 JOIN mastodon_apps a ON a.id = t.app_id
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

export async function revokeAccessToken(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		token: string;
		clientId?: string | null;
	}
) {
	const db = getDb(event);
	if (!db) return false;

	const token = String(input.token || '').trim();
	if (!token) return false;

	if (input.clientId) {
		const result = await db
			.prepare(
				`DELETE FROM mastodon_access_tokens
				 WHERE token = ?
				   AND app_id IN (
					 SELECT id FROM mastodon_apps WHERE client_id = ?
				   )`
			)
			.bind(token, String(input.clientId).trim())
			.run();

		return Number(result.meta.changes || 0) > 0;
	}

	const result = await db
		.prepare(`DELETE FROM mastodon_access_tokens WHERE token = ?`)
		.bind(token)
		.run();

	return Number(result.meta.changes || 0) > 0;
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
	return authorizeAdminPassword(event, submittedPassword);
}

export async function authorizeAdminPassword(
	event: Pick<RequestEvent, 'cookies'>,
	submittedPassword: string
) {
	const password = getAdminPassword();
	if (!password || submittedPassword !== password) {
		return false;
	}

	await createAdminSession(event.cookies);
	return true;
}
