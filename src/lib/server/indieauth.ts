import { env } from '$env/dynamic/private';
import { error, redirect, type RequestEvent } from '@sveltejs/kit';

type IndieAuthDb = NonNullable<App.Platform['env']['D1_DATABASE']>;

export type IndieAuthTokenRecord = {
	accessToken: string;
	clientId: string;
	scope: string;
	me: string;
	createdAt: string;
	lastUsedAt: string | null;
};

function getDb(event: Pick<RequestEvent, 'platform'>): IndieAuthDb | null {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

function getPassword() {
	return String(env.MICROPUB_PASSWORD || env.INDIEAUTH_PASSWORD || '').trim();
}

export function getMe(origin: string) {
	return `${origin}/`;
}

export function validateMe(value: string, origin: string) {
	const trimmed = String(value || '').trim();

	if (!trimmed) {
		return getMe(origin);
	}

	let meUrl: URL;
	let originUrl: URL;

	try {
		meUrl = new URL(trimmed);
		originUrl = new URL(origin);
	} catch {
		throw error(400, 'Invalid me');
	}

	const sameHost = meUrl.host === originUrl.host;
	const allowedProtocol = /^(https?:)$/i.test(meUrl.protocol);

	if (!sameHost || !allowedProtocol) {
		throw error(400, 'Invalid me');
	}

	if (!meUrl.pathname || meUrl.pathname === '') {
		meUrl.pathname = '/';
	}

	return meUrl.toString();
}

function base64UrlEncode(bytes: Uint8Array) {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(value: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return base64UrlEncode(new Uint8Array(digest));
}

export function validateClientId(value: string) {
	try {
		const url = new URL(String(value || '').trim());
		if (!/^https?:$/.test(url.protocol)) {
			throw new Error('client_id must be http or https');
		}
		return url.toString();
	} catch {
		throw error(400, 'Invalid client_id');
	}
}

export function validateRedirectUri(value: string) {
	try {
		const url = new URL(String(value || '').trim());
		if (/^(javascript|data):$/i.test(url.protocol)) {
			throw new Error('invalid redirect protocol');
		}
		return url.toString();
	} catch {
		throw error(400, 'Invalid redirect_uri');
	}
}

export async function createAuthorizationCode(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		clientId: string;
		redirectUri: string;
		me: string;
		scope: string;
		codeChallenge?: string | null;
		codeChallengeMethod?: string | null;
	}
) {
	const db = getDb(event);
	if (!db) throw error(500, 'D1 database is not configured');

	const code = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

	await db
		.prepare(
			`INSERT INTO indieauth_codes (
				code, client_id, redirect_uri, me, scope, code_challenge, code_challenge_method, expires_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			code,
			input.clientId,
			input.redirectUri,
			input.me,
			input.scope || '',
			input.codeChallenge ?? null,
			input.codeChallengeMethod ?? null,
			expiresAt
		)
		.run();

	return code;
}

export async function exchangeAuthorizationCode(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		code: string;
		clientId: string;
		redirectUri: string;
		codeVerifier?: string | null;
		me: string;
	}
) {
	const db = getDb(event);
	if (!db) throw error(500, 'D1 database is not configured');

	const row = await db
		.prepare(
			`SELECT code, client_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at, used_at
			        , me
			 FROM indieauth_codes
			 WHERE code = ?
			 LIMIT 1`
		)
		.bind(input.code)
		.first<Record<string, unknown>>();

	if (!row) {
		throw error(400, 'Invalid authorization code');
	}

	if (row.used_at) {
		throw error(400, 'Authorization code has already been used');
	}

	if (String(row.client_id) !== input.clientId || String(row.redirect_uri) !== input.redirectUri) {
		throw error(400, 'Authorization code does not match client');
	}

	if (Date.parse(String(row.expires_at)) < Date.now()) {
		throw error(400, 'Authorization code has expired');
	}

	const codeChallenge = row.code_challenge ? String(row.code_challenge) : null;
	const codeChallengeMethod = row.code_challenge_method ? String(row.code_challenge_method) : null;

	if (codeChallenge) {
		if (!input.codeVerifier) {
			throw error(400, 'Missing code_verifier');
		}

		const verifier =
			codeChallengeMethod === 'S256'
				? await sha256Base64Url(input.codeVerifier)
				: input.codeVerifier;

		if (verifier !== codeChallenge) {
			throw error(400, 'Invalid code_verifier');
		}
	}

	const accessToken = crypto.randomUUID().replace(/-/g, '');
	const scope = String(row.scope || '').trim();
	const me = String(row.me || input.me || '').trim() || input.me;

	await db.batch([
		db
			.prepare(
				`UPDATE indieauth_codes
				 SET used_at = CURRENT_TIMESTAMP
				 WHERE code = ?`
			)
			.bind(input.code),
		db
			.prepare(
				`INSERT INTO indieauth_tokens (access_token, client_id, scope, me)
				 VALUES (?, ?, ?, ?)`
			)
			.bind(accessToken, input.clientId, scope, me)
	]);

	return {
		accessToken,
		scope,
		me
	};
}

export async function getAccessTokenRecord(
	event: Pick<RequestEvent, 'platform'>,
	accessToken: string
): Promise<IndieAuthTokenRecord | null> {
	const db = getDb(event);
	if (!db) return null;

	const row = await db
		.prepare(
			`SELECT access_token, client_id, scope, me, created_at, last_used_at
			 FROM indieauth_tokens
			 WHERE access_token = ?
			 LIMIT 1`
		)
		.bind(accessToken)
		.first<Record<string, unknown>>();

	if (!row) return null;

	await db
		.prepare(
			`UPDATE indieauth_tokens
			 SET last_used_at = CURRENT_TIMESTAMP
			 WHERE access_token = ?`
		)
		.bind(accessToken)
		.run();

	return {
		accessToken: String(row.access_token || ''),
		clientId: String(row.client_id || ''),
		scope: String(row.scope || ''),
		me: String(row.me || ''),
		createdAt: String(row.created_at || ''),
		lastUsedAt: row.last_used_at ? String(row.last_used_at) : null
	};
}

function getBearerToken(request: Request) {
	const header = request.headers.get('authorization') || '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	return match?.[1]?.trim() || null;
}

export async function requireMicropubToken(event: RequestEvent) {
	const accessToken =
		getBearerToken(event.request) ||
		new URL(event.request.url).searchParams.get('access_token')?.trim() ||
		null;

	if (!accessToken) {
		throw error(401, 'Missing access token');
	}

	const token = await getAccessTokenRecord(event, accessToken);
	if (!token) {
		throw error(401, 'Invalid access token');
	}

	return token;
}

export function requireMicropubPassword(password: string) {
	const expected = getPassword();

	if (!expected) {
		throw error(500, 'MICROPUB_PASSWORD is not configured');
	}

	if (String(password || '').trim() !== expected) {
		throw error(401, 'Invalid password');
	}
}

export function redirectWithCode(input: {
	redirectUri: string;
	code: string;
	me: string;
	state?: string | null;
}) {
	const target = new URL(input.redirectUri);
	target.searchParams.set('code', input.code);
	target.searchParams.set('me', input.me);

	if (input.state) {
		target.searchParams.set('state', input.state);
	}

	throw redirect(302, target.toString());
}
