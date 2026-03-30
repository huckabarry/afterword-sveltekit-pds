import { env } from '$env/dynamic/private';
import { resolveAtprotoDid, resolveAtprotoService } from '$lib/server/atproto-identity';

const DEFAULT_REPO = 'did:plc:vt4k6d3e5rjw65cuzaf3nufq';
const STATUS_COLLECTION = 'app.bsky.feed.post';
const CREATE_SESSION_NSID = 'com.atproto.server.createSession';
const GET_RECORD_NSID = 'com.atproto.repo.getRecord';
const PUT_RECORD_NSID = 'com.atproto.repo.putRecord';
const DELETE_RECORD_NSID = 'com.atproto.repo.deleteRecord';

type AtprotoSession = {
	serviceUrl: string;
	did: string;
	accessJwt: string;
	identifier: string;
};

type CachedAtprotoSession = AtprotoSession & {
	expiresAt: number;
};

let statusSessionCache: CachedAtprotoSession | null = null;
let statusSessionPromise: Promise<AtprotoSession> | null = null;

function normalizeString(value: unknown) {
	return String(value || '').trim();
}

function getConfiguredRepoIdentifier() {
	return (
		String(
			env.ATPROTO_REPO ||
				process.env.ATPROTO_REPO ||
				env.STANDARD_SITE_IDENTIFIER ||
				env.ATPROTO_IDENTIFIER ||
				env.ATP_IDENTIFIER ||
				DEFAULT_REPO
		)
			.trim()
			.replace(/\/+$/, '') || DEFAULT_REPO
	);
}

function getConfiguredServiceUrl() {
	return String(
		env.STANDARD_SITE_PDS_URL || env.ATPROTO_PDS_URL || env.PDS_URL || env.ATP_BASE_URL || ''
	)
		.trim()
		.replace(/\/+$/, '');
}

function getConfiguredLoginIdentifiers(repoIdentifier = getConfiguredRepoIdentifier()) {
	return [
		env.STANDARD_SITE_LOGIN_IDENTIFIER,
		env.ATPROTO_LOGIN_IDENTIFIER,
		env.ATP_LOGIN_IDENTIFIER,
		env.STANDARD_SITE_EMAIL,
		env.ATPROTO_EMAIL,
		env.ATP_EMAIL,
		env.STANDARD_SITE_IDENTIFIER,
		env.ATPROTO_IDENTIFIER,
		env.ATP_IDENTIFIER,
		env.ATPROTO_REPO,
		process.env.ATPROTO_REPO,
		repoIdentifier,
		DEFAULT_REPO
	]
		.map((value) => String(value || '').trim())
		.filter(Boolean)
		.filter((value, index, values) => values.indexOf(value) === index);
}

function getConfiguredAppPassword() {
	return String(
		env.STANDARD_SITE_APP_PASSWORD || env.ATPROTO_APP_PASSWORD || env.ATP_APP_PASSWORD || ''
	).trim();
}

async function getConfiguredRepoIdentity() {
	const repoIdentifier = getConfiguredRepoIdentifier();
	const configuredServiceUrl = getConfiguredServiceUrl();

	try {
		return {
			repoIdentifier,
			...(await resolveAtprotoService(repoIdentifier))
		};
	} catch (error) {
		if (!configuredServiceUrl) {
			throw error;
		}

		return {
			repoIdentifier,
			did: await resolveAtprotoDid(repoIdentifier),
			serviceUrl: configuredServiceUrl
		};
	}
}

function formatSessionCreationError(
	identifiers: string[],
	lastStatus: number | null,
	lastIdentifier: string | null
) {
	const tried = identifiers.join(', ');

	if (lastStatus === 401) {
		return `ATProto session creation failed with 401 for ${lastIdentifier || 'the configured identifiers'}. Tried: ${tried}.`;
	}

	if (lastStatus) {
		return `ATProto session creation failed with ${lastStatus} for ${lastIdentifier || 'the configured identifiers'}. Tried: ${tried}.`;
	}

	return `ATProto session creation failed for the configured identifiers. Tried: ${tried}.`;
}

async function createSession(): Promise<AtprotoSession> {
	const repoIdentifier = getConfiguredRepoIdentifier();
	const identifiers = getConfiguredLoginIdentifiers(repoIdentifier);
	const password = getConfiguredAppPassword();

	if (!repoIdentifier || !identifiers.length || !password) {
		throw new Error(
			'Status editing credentials are incomplete. Set STANDARD_SITE_APP_PASSWORD plus a repo or login identifier.'
		);
	}

	const { did: resolvedDid, serviceUrl } = await getConfiguredRepoIdentity();

	if (
		statusSessionCache &&
		statusSessionCache.expiresAt > Date.now() &&
		statusSessionCache.serviceUrl === serviceUrl &&
		identifiers.includes(statusSessionCache.identifier)
	) {
		return statusSessionCache;
	}

	if (statusSessionPromise) {
		return await statusSessionPromise;
	}

	statusSessionPromise = (async () => {
		let lastError: Error | null = null;
		let lastStatus: number | null = null;
		let lastIdentifier: string | null = null;

		for (const identifier of identifiers) {
			try {
				const response = await fetch(`${serviceUrl}/xrpc/${CREATE_SESSION_NSID}`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json'
					},
					body: JSON.stringify({
						identifier,
						password
					})
				});

				if (!response.ok) {
					lastStatus = response.status;
					lastIdentifier = identifier;
					lastError = new Error(
						formatSessionCreationError(identifiers, lastStatus, lastIdentifier)
					);
					continue;
				}

				const payload = (await response.json()) as { did?: string; accessJwt?: string };
				const did = normalizeString(payload.did) || resolvedDid;
				const accessJwt = normalizeString(payload.accessJwt);

				if (!did || !accessJwt) {
					throw new Error('ATProto session did not return a DID and access token');
				}

				const session: CachedAtprotoSession = {
					serviceUrl,
					did,
					accessJwt,
					identifier,
					expiresAt: Date.now() + 1000 * 60 * 20
				};
				statusSessionCache = session;
				return session;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error('ATProto session creation failed');
			}
		}

		throw (
			lastError || new Error(formatSessionCreationError(identifiers, lastStatus, lastIdentifier))
		);
	})();

	try {
		return await statusSessionPromise;
	} finally {
		statusSessionPromise = null;
	}
}

function getRecordKey(uri: string) {
	return String(uri || '').split('/').pop() || '';
}

export function getStatusRecordKey(uri: string) {
	const rkey = getRecordKey(uri);
	if (!rkey) {
		throw new Error('Unable to determine status record key.');
	}
	return rkey;
}

export async function getStatusRecord(rkey: string) {
	const session = await createSession();
	const params = new URLSearchParams({
		repo: session.did,
		collection: STATUS_COLLECTION,
		rkey
	});

	const response = await fetch(`${session.serviceUrl}/xrpc/${GET_RECORD_NSID}?${params.toString()}`, {
		headers: {
			authorization: `Bearer ${session.accessJwt}`,
			accept: 'application/json'
		}
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`ATProto getRecord failed for ${STATUS_COLLECTION}/${rkey}: ${response.status} ${text}`);
	}

	return (await response.json()) as { value?: Record<string, unknown>; uri?: string; cid?: string };
}

export async function updateStatusText(rkey: string, text: string) {
	const session = await createSession();
	const existing = await getStatusRecord(rkey);
	const value = { ...(existing.value || {}) };

	value.$type = STATUS_COLLECTION;
	value.text = text;
	delete value.facets;
	delete value.entities;

	const response = await fetch(`${session.serviceUrl}/xrpc/${PUT_RECORD_NSID}`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${session.accessJwt}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			repo: session.did,
			collection: STATUS_COLLECTION,
			rkey,
			record: value
		})
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`ATProto putRecord failed for ${STATUS_COLLECTION}/${rkey}: ${response.status} ${body}`);
	}

	return (await response.json()) as { uri?: string; cid?: string };
}

export async function deleteStatusRecord(rkey: string) {
	const session = await createSession();
	const response = await fetch(`${session.serviceUrl}/xrpc/${DELETE_RECORD_NSID}`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${session.accessJwt}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			repo: session.did,
			collection: STATUS_COLLECTION,
			rkey
		})
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`ATProto deleteRecord failed for ${STATUS_COLLECTION}/${rkey}: ${response.status} ${body}`
		);
	}
}
