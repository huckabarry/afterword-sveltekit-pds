import { error } from '@sveltejs/kit';
import { inferImageMimeType } from '$lib/server/image-metadata';

function isHttpImageUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

function responseFromObject(
	object: Awaited<ReturnType<NonNullable<App.Platform['env']['R2_BUCKET']>['get']>>
) {
	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set('etag', object.httpEtag);
	headers.set(
		'cache-control',
		headers.get('cache-control') || 'public, max-age=31536000, immutable'
	);

	return new Response(object.body, {
		headers
	});
}

export async function GET(event) {
	const bucket = event.platform?.env.R2_BUCKET;

	if (!bucket) {
		throw error(500, 'R2_BUCKET is not configured');
	}

	const key = event.params.key;

	if (!key) {
		throw error(404, 'Asset not found');
	}

	const existing = await bucket.get(key);

	if (existing) {
		return responseFromObject(existing);
	}

	const sourceUrl = String(event.url.searchParams.get('src') || '').trim();

	if (!isHttpImageUrl(sourceUrl)) {
		throw error(404, 'Asset not found');
	}

	const upstream = await fetch(sourceUrl, {
		headers: {
			Accept: 'image/*,*/*;q=0.8'
		}
	});

	if (!upstream.ok) {
		throw error(upstream.status, 'Asset not found');
	}

	const contentTypeHeader = String(upstream.headers.get('content-type') || '')
		.trim()
		.split(';')[0];
	const contentType =
		contentTypeHeader && contentTypeHeader.startsWith('image/')
			? contentTypeHeader
			: inferImageMimeType(sourceUrl);
	const body = await upstream.arrayBuffer();

	if (!body.byteLength) {
		throw error(404, 'Asset not found');
	}

	await bucket.put(key, body, {
		httpMetadata: {
			contentType,
			cacheControl: 'public, max-age=31536000, immutable'
		},
		customMetadata: {
			sourceUrl
		}
	});

	return new Response(body, {
		headers: {
			'content-type': contentType,
			'cache-control': 'public, max-age=31536000, immutable'
		}
	});
}
