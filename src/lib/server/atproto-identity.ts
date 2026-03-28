const PLC_DIRECTORY_URL = 'https://plc.directory';
const RESOLVE_HANDLE_URL = 'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle';

function getDidCache() {
	const scope = globalThis as typeof globalThis & {
		__afterwordDidCache?: Map<string, string>;
	};
	if (!scope.__afterwordDidCache) {
		scope.__afterwordDidCache = new Map<string, string>();
	}
	return scope.__afterwordDidCache;
}

function getPdsCache() {
	const scope = globalThis as typeof globalThis & {
		__afterwordPdsCache?: Map<string, string>;
	};
	if (!scope.__afterwordPdsCache) {
		scope.__afterwordPdsCache = new Map<string, string>();
	}
	return scope.__afterwordPdsCache;
}

export async function resolveAtprotoDid(identifier: string) {
	const normalized = String(identifier || '').trim();

	if (!normalized) {
		throw new Error('ATProto identifier is not configured');
	}

	if (normalized.startsWith('did:')) {
		return normalized;
	}

	const didCache = getDidCache();
	const cached = didCache.get(normalized);
	if (cached) {
		return cached;
	}

	const response = await fetch(`${RESOLVE_HANDLE_URL}?handle=${encodeURIComponent(normalized)}`);
	if (!response.ok) {
		throw new Error(`Unable to resolve ATProto handle ${normalized}: ${response.status}`);
	}

	const payload = (await response.json()) as { did?: string };
	const did = String(payload?.did || '').trim();

	if (!did) {
		throw new Error(`ATProto handle ${normalized} did not resolve to a DID`);
	}

	didCache.set(normalized, did);
	return did;
}

export async function resolveAtprotoService(identifier: string) {
	const did = await resolveAtprotoDid(identifier);
	const pdsCache = getPdsCache();
	const cached = pdsCache.get(did);

	if (cached) {
		return { did, serviceUrl: cached };
	}

	const response = await fetch(`${PLC_DIRECTORY_URL}/${encodeURIComponent(did)}`);
	if (!response.ok) {
		throw new Error(`Unable to resolve DID document for ${did}: ${response.status}`);
	}

	const payload = (await response.json()) as {
		service?: Array<{ id?: string; type?: string; serviceEndpoint?: string }>;
	};
	const serviceUrl =
		payload.service?.find((service) => service.type === 'AtprotoPersonalDataServer')
			?.serviceEndpoint || '';

	if (!serviceUrl) {
		throw new Error(`DID document for ${did} did not include a PDS service endpoint`);
	}

	const normalizedUrl = serviceUrl.replace(/\/+$/, '');
	pdsCache.set(did, normalizedUrl);
	return {
		did,
		serviceUrl: normalizedUrl
	};
}
