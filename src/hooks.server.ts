import type { Handle } from '@sveltejs/kit';
import { hasValidAdminSecret } from '$lib/server/admin';

const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PUBLIC_CROSS_ORIGIN_FORM_PATHS = new Set(['/webmention', '/api/swarm/push']);

function isFormContentType(request: Request) {
	const contentType = request.headers.get('content-type') || '';
	const [mediaType] = contentType.split(';', 1);
	const normalized = mediaType?.trim().toLowerCase() || '';

	return (
		normalized === 'application/x-www-form-urlencoded' ||
		normalized === 'multipart/form-data' ||
		normalized === 'text/plain'
	);
}

function hasSameOriginFormContext(request: Request, url: URL) {
	const origin = request.headers.get('origin');

	if (origin) {
		return origin === url.origin;
	}

	const referer = request.headers.get('referer');

	if (!referer) {
		return false;
	}

	try {
		return new URL(referer).origin === url.origin;
	} catch {
		return false;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const { request, url } = event;

	if (
		CSRF_PROTECTED_METHODS.has(request.method) &&
		isFormContentType(request) &&
		!PUBLIC_CROSS_ORIGIN_FORM_PATHS.has(url.pathname) &&
		!hasValidAdminSecret(request) &&
		!hasSameOriginFormContext(request, url)
	) {
		const message = `Cross-site ${request.method} form submissions are forbidden`;

		if (request.headers.get('accept') === 'application/json') {
			return new Response(JSON.stringify({ message }), {
				status: 403,
				headers: {
					'content-type': 'application/json; charset=utf-8'
				}
			});
		}

		return new Response(message, { status: 403 });
	}

	return resolve(event);
};
