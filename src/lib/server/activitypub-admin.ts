import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

function getBearerToken(request: Request) {
	const header = request.headers.get('authorization') || '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	return match?.[1]?.trim() || null;
}

export function requireDeliveryToken(request: Request) {
	const expected = String(env.ACTIVITYPUB_DELIVERY_TOKEN || '').trim();

	if (!expected) {
		throw error(500, 'ACTIVITYPUB_DELIVERY_TOKEN is not configured');
	}

	const provided =
		getBearerToken(request) ||
		request.headers.get('x-activitypub-token')?.trim() ||
		new URL(request.url).searchParams.get('token')?.trim() ||
		null;

	if (!provided || provided !== expected) {
		throw error(401, 'Invalid delivery token');
	}
}
