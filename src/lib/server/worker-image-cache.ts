type CachePutContext = {
	waitUntil?: (promise: Promise<unknown>) => void;
};

type WorkerCacheStorage = CacheStorage & {
	default?: Cache;
};

function getDefaultCache() {
	return (globalThis.caches as WorkerCacheStorage | undefined)?.default ?? null;
}

function cloneWithCacheHeaders(response: Response) {
	const headers = new Headers(response.headers);
	headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable');

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

export async function matchCachedImage(request: Request) {
	const cache = getDefaultCache();

	if (!cache || request.method !== 'GET') {
		return null;
	}

	return cache.match(request);
}

export function cacheImageResponse(
	request: Request,
	response: Response,
	context?: CachePutContext | null
) {
	const cache = getDefaultCache();

	if (!cache || request.method !== 'GET' || !response.ok) {
		return response;
	}

	const cacheable = cloneWithCacheHeaders(response);
	context?.waitUntil?.(cache.put(request, cacheable.clone()));
	return cacheable;
}
