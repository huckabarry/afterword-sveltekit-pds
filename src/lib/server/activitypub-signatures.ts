import type { RequestEvent } from '@sveltejs/kit';

type SignatureParts = {
	keyId: string;
	algorithm: string;
	headers: string[];
	signature: string;
};

type RemoteKey = {
	actorId: string;
	keyId: string;
	publicKeyPem: string;
};

function parseSignatureHeader(header: string | null): SignatureParts | null {
	if (!header) return null;

	const entries = new Map<string, string>();

	for (const part of header.split(',')) {
		const [rawKey, rawValue] = part.split('=');
		if (!rawKey || !rawValue) continue;
		const key = rawKey.trim();
		const value = rawValue.trim().replace(/^"|"$/g, '');
		entries.set(key, value);
	}

	const keyId = entries.get('keyId');
	const algorithm = entries.get('algorithm') || 'hs2019';
	const headers = (entries.get('headers') || '(request-target)')
		.split(/\s+/)
		.map((value) => value.trim())
		.filter(Boolean);
	const signature = entries.get('signature');

	if (!keyId || !signature) return null;

	return {
		keyId,
		algorithm,
		headers,
		signature
	};
}

function bytesToBase64(bytes: Uint8Array) {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

async function sha256Base64(value: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return bytesToBase64(new Uint8Array(digest));
}

function pemToArrayBuffer(pem: string) {
	const normalized = pem
		.replace(/-----BEGIN PUBLIC KEY-----/g, '')
		.replace(/-----END PUBLIC KEY-----/g, '')
		.replace(/\s+/g, '');
	const binary = atob(normalized);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes.buffer;
}

function getHeaderValue(event: RequestEvent, name: string) {
	if (name === '(request-target)') {
		return `${event.request.method.toLowerCase()} ${event.url.pathname}${event.url.search}`;
	}

	if (name === 'host') {
		return event.url.host;
	}

	return event.request.headers.get(name);
}

function buildSignedString(event: RequestEvent, headers: string[]) {
	const lines: string[] = [];

	for (const header of headers) {
		const value = getHeaderValue(event, header);
		if (!value) {
			throw new Error(`Missing signed header: ${header}`);
		}
		lines.push(`${header.toLowerCase()}: ${value}`);
	}

	return lines.join('\n');
}

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function fetchRemoteKey(actorId: string, keyId: string): Promise<RemoteKey> {
	const response = await fetch(actorId, {
		headers: {
			Accept: 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
		}
	});

	if (!response.ok) {
		throw new Error(`Could not fetch actor ${actorId}: ${response.status}`);
	}

	const actor = (await response.json()) as Record<string, unknown>;
	const publicKey =
		actor.publicKey && typeof actor.publicKey === 'object'
			? (actor.publicKey as Record<string, unknown>)
			: null;

	const resolvedKeyId = getString(publicKey?.id);
	const owner = getString(publicKey?.owner) || getString(actor.id);
	const publicKeyPem = getString(publicKey?.publicKeyPem);

	if (!resolvedKeyId || !owner || !publicKeyPem) {
		throw new Error('Remote actor did not expose a usable public key');
	}

	if (resolvedKeyId !== keyId) {
		throw new Error('Signature keyId did not match remote actor public key');
	}

	return {
		actorId: owner,
		keyId: resolvedKeyId,
		publicKeyPem
	};
}

function decodeBase64(value: string) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

async function verifySignedString(signature: SignatureParts, signedString: string, publicKeyPem: string) {
	const key = await crypto.subtle.importKey(
		'spki',
		pemToArrayBuffer(publicKeyPem),
		{
			name: 'RSASSA-PKCS1-v1_5',
			hash: 'SHA-256'
		},
		false,
		['verify']
	);

	return crypto.subtle.verify(
		'RSASSA-PKCS1-v1_5',
		key,
		decodeBase64(signature.signature),
		new TextEncoder().encode(signedString)
	);
}

function assertFreshDate(dateHeader: string | null) {
	if (!dateHeader) {
		throw new Error('Missing Date header');
	}

	const timestamp = new Date(dateHeader).getTime();
	if (!Number.isFinite(timestamp)) {
		throw new Error('Invalid Date header');
	}

	const driftMs = Math.abs(Date.now() - timestamp);
	if (driftMs > 1000 * 60 * 60 * 12) {
		throw new Error('Date header is too old');
	}
}

export async function verifyInboundActivitySignature(event: RequestEvent, body: string) {
	const signature = parseSignatureHeader(event.request.headers.get('signature'));
	if (!signature) {
		throw new Error('Missing Signature header');
	}

	assertFreshDate(event.request.headers.get('date'));

	const digestHeader = event.request.headers.get('digest');
	if (!digestHeader) {
		throw new Error('Missing Digest header');
	}

	const expectedDigest = `SHA-256=${await sha256Base64(body)}`;
	if (digestHeader !== expectedDigest) {
		throw new Error('Digest verification failed');
	}

	const signedString = buildSignedString(event, signature.headers);
	const actorIdFromKey = signature.keyId.replace(/#.*$/, '');
	const remoteKey = await fetchRemoteKey(actorIdFromKey, signature.keyId);
	const verified = await verifySignedString(signature, signedString, remoteKey.publicKeyPem);

	if (!verified) {
		throw new Error('Signature verification failed');
	}

	return {
		actorId: remoteKey.actorId,
		keyId: remoteKey.keyId
	};
}

