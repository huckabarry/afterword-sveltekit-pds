import type { Handle } from '@sveltejs/kit';

function isCorsPath(pathname: string) {
	return (
		pathname.startsWith('/api/') ||
		pathname === '/oauth/token' ||
		pathname === '/oauth/revoke' ||
		pathname === '/.well-known/nodeinfo' ||
		pathname.startsWith('/nodeinfo/')
	);
}

function applyCorsHeaders(response: Response, origin: string | null) {
	response.headers.set('access-control-allow-origin', origin || '*');
	response.headers.set('vary', 'Origin');
	response.headers.set('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
	response.headers.set('access-control-allow-headers', 'authorization, content-type');
	response.headers.set('access-control-expose-headers', 'link');
	return response;
}

export const handle: Handle = async ({ event, resolve }) => {
	if (isCorsPath(event.url.pathname) && event.request.method === 'OPTIONS') {
		return applyCorsHeaders(new Response(null, { status: 204 }), event.request.headers.get('origin'));
	}

	const response = await resolve(event);

	if (response.status === 404 && isCorsPath(event.url.pathname)) {
		console.warn('[mastodon-api-404]', event.request.method, event.url.pathname, event.url.search);
	}

	if (response.status >= 500 && isCorsPath(event.url.pathname)) {
		console.error('[mastodon-api-500]', event.request.method, event.url.pathname, event.url.search);
	}

	if (isCorsPath(event.url.pathname)) {
		applyCorsHeaders(response, event.request.headers.get('origin'));
	}

	return response;
};
