import { getActivityPubKeyId, getActivityPubPrivateKeyPem } from '$lib/server/activitypub';

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
		.replace(/-----BEGIN PRIVATE KEY-----/g, '')
		.replace(/-----END PRIVATE KEY-----/g, '')
		.replace(/\s+/g, '');
	const binary = atob(normalized);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes.buffer;
}

async function signString(value: string, privateKeyPem: string) {
	const key = await crypto.subtle.importKey(
		'pkcs8',
		pemToArrayBuffer(privateKeyPem),
		{
			name: 'RSASSA-PKCS1-v1_5',
			hash: 'SHA-256'
		},
		false,
		['sign']
	);

	const signature = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		key,
		new TextEncoder().encode(value)
	);

	return bytesToBase64(new Uint8Array(signature));
}

export async function sendSignedActivity(origin: string, inboxUrl: string, activity: unknown) {
	const privateKeyPem = getActivityPubPrivateKeyPem();

	if (!privateKeyPem) {
		throw new Error('ACTIVITYPUB_PRIVATE_KEY_PEM is not configured');
	}

	const body = JSON.stringify(activity);
	const url = new URL(inboxUrl);
	const date = new Date().toUTCString();
	const digest = `SHA-256=${await sha256Base64(body)}`;
	const keyId = getActivityPubKeyId(origin);
	const signedHeaders = ['(request-target)', 'host', 'date', 'digest', 'content-type'];
	const signingString = [
		`(request-target): post ${url.pathname}${url.search}`,
		`host: ${url.host}`,
		`date: ${date}`,
		`digest: ${digest}`,
		'content-type: application/activity+json'
	].join('\n');

	const signature = await signString(signingString, privateKeyPem);
	const signatureHeader = `keyId="${keyId}",algorithm="rsa-sha256",headers="${signedHeaders.join(
		' '
	)}",signature="${signature}"`;

	const response = await fetch(url.toString(), {
		method: 'POST',
		headers: {
			Accept: 'application/activity+json',
			'Content-Type': 'application/activity+json',
			Date: date,
			Digest: digest,
			Host: url.host,
			Signature: signatureHeader
		},
		body
	});

	if (!response.ok) {
		throw new Error(`Remote inbox returned ${response.status}`);
	}

	return response;
}

