import { env } from '$env/dynamic/private';
import { inferImageMimeType } from '$lib/server/image-metadata';
import { resolveAtprotoDid, resolveAtprotoService } from '$lib/server/atproto-identity';

const DEFAULT_REPO = 'did:plc:vt4k6d3e5rjw65cuzaf3nufq';
export const PDS_CHECKIN_COLLECTION = 'blog.afterword.checkin';
const CREATE_SESSION_NSID = 'com.atproto.server.createSession';
const PUT_RECORD_NSID = 'com.atproto.repo.putRecord';
const UPLOAD_BLOB_NSID = 'com.atproto.repo.uploadBlob';
const IMAGE_FETCH_USER_AGENT = 'afterword-sveltekit-pds swarm-sync';

type AtprotoSession = {
	serviceUrl: string;
	did: string;
	accessJwt: string;
	identifier: string;
};

type CachedAtprotoSession = AtprotoSession & {
	expiresAt: number;
};

type AtprotoBlob = {
	ref: { $link: string };
	mimeType: string;
	size: number;
	$type?: string;
};

type CheckinImageBlob = AtprotoBlob;

type PutRecordResponse = {
	uri?: string;
	cid?: string;
};

export type CheckinRecordInput = {
	rkey: string;
	record: Record<string, unknown>;
};

let pdsCheckinSessionCache: CachedAtprotoSession | null = null;
let pdsCheckinSessionPromise: Promise<AtprotoSession> | null = null;

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

function normalizeString(value: unknown) {
	return String(value || '').trim();
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
			'Check-in sync credentials are incomplete. Set STANDARD_SITE_APP_PASSWORD plus a repo or login identifier.'
		);
	}

	const { did: resolvedDid, serviceUrl } = await getConfiguredRepoIdentity();

	if (
		pdsCheckinSessionCache &&
		pdsCheckinSessionCache.expiresAt > Date.now() &&
		pdsCheckinSessionCache.serviceUrl === serviceUrl &&
		identifiers.includes(pdsCheckinSessionCache.identifier)
	) {
		return pdsCheckinSessionCache;
	}

	if (pdsCheckinSessionPromise) {
		return await pdsCheckinSessionPromise;
	}

	pdsCheckinSessionPromise = (async () => {
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
				pdsCheckinSessionCache = session;
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
		return await pdsCheckinSessionPromise;
	} finally {
		pdsCheckinSessionPromise = null;
	}
}

async function uploadBlob(
	session: AtprotoSession,
	buffer: ArrayBuffer,
	mimeType: string
): Promise<AtprotoBlob> {
	const response = await fetch(`${session.serviceUrl}/xrpc/${UPLOAD_BLOB_NSID}`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${session.accessJwt}`,
			'content-type': mimeType
		},
		body: buffer
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`ATProto uploadBlob failed: ${response.status} ${text}`);
	}

	const payload = (await response.json()) as { blob?: AtprotoBlob };
	if (!payload?.blob?.ref?.$link) {
		throw new Error('ATProto uploadBlob did not return a blob ref');
	}

	return payload.blob;
}

async function putRecord(
	session: AtprotoSession,
	collection: string,
	rkey: string,
	record: Record<string, unknown>
) {
	const response = await fetch(`${session.serviceUrl}/xrpc/${PUT_RECORD_NSID}`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${session.accessJwt}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			repo: session.did,
			collection,
			rkey,
			record,
			validate: false
		})
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`ATProto putRecord failed for ${collection}/${rkey}: ${response.status} ${text}`);
	}

	return (await response.json()) as PutRecordResponse;
}

export async function uploadRemoteCheckinImage(
	session: AtprotoSession,
	url: string,
	imageCache: Map<string, CheckinImageBlob | null>
) {
	const normalized = normalizeString(url);

	if (!normalized) {
		return null;
	}

	if (imageCache.has(normalized)) {
		return imageCache.get(normalized) || null;
	}

	const response = await fetch(normalized, {
		headers: {
			accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
			'user-agent': IMAGE_FETCH_USER_AGENT
		}
	});

	if (!response.ok) {
		imageCache.set(normalized, null);
		throw new Error(`Unable to fetch Swarm image: ${response.status} ${normalized}`);
	}

	const mimeTypeHeader = normalizeString(response.headers.get('content-type')).split(';')[0] || '';
	const mimeType =
		mimeTypeHeader && mimeTypeHeader.startsWith('image/')
			? mimeTypeHeader
			: inferImageMimeType(normalized);
	const buffer = await response.arrayBuffer();

	if (!buffer.byteLength) {
		imageCache.set(normalized, null);
		return null;
	}

	const blob = await uploadBlob(session, buffer, mimeType);
	imageCache.set(normalized, blob);
	return blob;
}

export async function putCheckinRecord(input: CheckinRecordInput) {
	const session = await createSession();
	return await putRecord(session, PDS_CHECKIN_COLLECTION, input.rkey, input.record);
}

export async function getCheckinWriterSession() {
	return await createSession();
}
