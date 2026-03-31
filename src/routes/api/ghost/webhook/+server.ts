import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { clearGhostLivePostsCache } from '$lib/server/ghost';
import {
	syncGhostPostPhotoManifestBySlug,
	syncRecentPhotoManifestBatch
} from '$lib/server/photo-manifest';

const MAX_SIGNATURE_AGE_MS = 1000 * 60 * 10;
const textEncoder = new TextEncoder();

type GhostSignature = {
	timestamp: number | null;
	sha256: string | null;
};

function parseGhostSignature(header: string | null): GhostSignature {
	const parts = String(header || '')
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);

	let timestamp: number | null = null;
	let sha256: string | null = null;

	for (const part of parts) {
		const [key, value] = part.split('=', 2).map((segment) => segment.trim());

		if (!key || !value) continue;

		if (key === 't') {
			const parsed = Number.parseInt(value, 10);
			timestamp = Number.isFinite(parsed) ? parsed : null;
		}

		if (key === 'sha256') {
			sha256 = value.toLowerCase();
		}
	}

	return { timestamp, sha256 };
}

function toHex(buffer: ArrayBuffer) {
	return Array.from(new Uint8Array(buffer))
		.map((value) => value.toString(16).padStart(2, '0'))
		.join('');
}

async function createSignature(secret: string, payload: string, timestamp: number) {
	const key = await crypto.subtle.importKey(
		'raw',
		textEncoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const message = `${payload}${timestamp}`;
	const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(message));
	return toHex(signature);
}

async function hasValidGhostSignature(request: Request, payload: string) {
	const secret = String(env.GHOST_WEBHOOK_SECRET || '').trim();

	if (!secret) {
		return true;
	}

	const signature = parseGhostSignature(request.headers.get('x-ghost-signature'));

	if (!signature.sha256 || !signature.timestamp) {
		return false;
	}

	const ageMs = Math.abs(Date.now() - signature.timestamp * 1000);

	if (ageMs > MAX_SIGNATURE_AGE_MS) {
		return false;
	}

	const expected = await createSignature(secret, payload, signature.timestamp);
	return expected === signature.sha256;
}

function extractGhostPostSlug(payload: Record<string, unknown> | null) {
	const post =
		payload && typeof payload.post === 'object' && payload.post
			? (payload.post as Record<string, unknown>)
			: null;
	const current = post && typeof post.current === 'object' ? post.current : null;
	const previous = post && typeof post.previous === 'object' ? post.previous : null;

	if (current && typeof current === 'object' && 'slug' in current) {
		const slug = String((current as { slug?: unknown }).slug || '').trim();
		if (slug) return slug;
	}

	if (previous && typeof previous === 'object' && 'slug' in previous) {
		const slug = String((previous as { slug?: unknown }).slug || '').trim();
		if (slug) return slug;
	}

	return null;
}

export async function POST(event) {
	const payload = await event.request.text();

	if (!(await hasValidGhostSignature(event.request, payload))) {
		return json({ ok: false, error: 'Invalid Ghost webhook signature.' }, { status: 401 });
	}

	let parsedPayload: Record<string, unknown> | null = null;

	try {
		parsedPayload = payload ? (JSON.parse(payload) as Record<string, unknown>) : null;
	} catch {
		parsedPayload = null;
	}

	const slug = extractGhostPostSlug(parsedPayload);
	clearGhostLivePostsCache();

	event.platform?.ctx.waitUntil(
		(slug
			? syncGhostPostPhotoManifestBySlug(event, slug)
			: syncRecentPhotoManifestBatch(event, { limit: 24 })
		).catch((error) => {
			console.error(
				`[ghost-webhook] Unable to sync ${
					slug ? `gallery post "${slug}"` : 'recent gallery photos'
				}:`,
				error instanceof Error ? error.message : String(error)
			);
		})
	);

	return json({
		ok: true,
		trigger: 'ghost-webhook',
		event: parsedPayload?.event || null,
		slug,
		receivedAt: new Date().toISOString()
	});
}
