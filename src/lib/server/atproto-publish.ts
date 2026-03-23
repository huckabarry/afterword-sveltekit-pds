import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

const DEFAULT_PDS_URL = 'https://bsky.social';
const CREATE_SESSION_URL = '/xrpc/com.atproto.server.createSession';
const CREATE_RECORD_URL = '/xrpc/com.atproto.repo.createRecord';

type Session = {
	did: string;
	handle: string;
	accessJwt: string;
};

let sessionCache: { expiresAt: number; session: Session } | null = null;

function getPdsUrl() {
	return String(env.ATPROTO_PDS_URL || DEFAULT_PDS_URL).trim().replace(/\/+$/, '');
}

function getIdentifier() {
	return String(env.ATPROTO_PUBLISH_HANDLE || '').trim() || 'afterword.blog';
}

function getAppPassword() {
	return String(env.ATPROTO_APP_PASSWORD || '').trim();
}

async function createSession(): Promise<Session> {
	const password = getAppPassword();

	if (!password) {
		throw error(500, 'ATPROTO_APP_PASSWORD is not configured');
	}

	const response = await fetch(`${getPdsUrl()}${CREATE_SESSION_URL}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json'
		},
		body: JSON.stringify({
			identifier: getIdentifier(),
			password
		})
	});

	if (!response.ok) {
		throw error(500, `ATProto session failed with ${response.status}`);
	}

	const data = (await response.json()) as Session;
	sessionCache = {
		expiresAt: Date.now() + 30 * 60 * 1000,
		session: data
	};
	return data;
}

async function getSession() {
	if (sessionCache && sessionCache.expiresAt > Date.now()) {
		return sessionCache.session;
	}

	return createSession();
}

export async function createAtprotoStatus(text: string) {
	const trimmed = String(text || '').trim();

	if (!trimmed) {
		throw error(422, 'Status text is required');
	}

	const session = await getSession();
	const createdAt = new Date().toISOString();
	const response = await fetch(`${getPdsUrl()}${CREATE_RECORD_URL}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json',
			authorization: `Bearer ${session.accessJwt}`
		},
		body: JSON.stringify({
			repo: session.did,
			collection: 'app.bsky.feed.post',
			record: {
				$text: undefined,
				$type: 'app.bsky.feed.post',
				text: trimmed,
				createdAt
			}
		})
	});

	if (!response.ok) {
		throw error(500, `ATProto createRecord failed with ${response.status}`);
	}

	const data = (await response.json()) as { uri: string; cid: string };
	const id = String(data.uri || '').split('/').pop() || '';

	return {
		id,
		uri: data.uri,
		cid: data.cid,
		createdAt,
		text: trimmed
	};
}
