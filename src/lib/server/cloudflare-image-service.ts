import { error } from '@sveltejs/kit';
import { inferImageMimeType } from '$lib/server/image-metadata';

type BoundBucket = NonNullable<App.Platform['env']['R2_BUCKET']>;
type BoundImages = NonNullable<App.Platform['env']['IMAGES']>;
type OutputImageFormat =
	| 'image/jpeg'
	| 'image/png'
	| 'image/gif'
	| 'image/webp'
	| 'image/avif';

type CfImagePreset = {
	width: number;
	quality: number;
};

type ResolvedImageSource = {
	body: ReadableStream<Uint8Array>;
	contentType: string;
	etag?: string;
};

function isHttpImageUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

function isSvgContentType(contentType: string) {
	return contentType === 'image/svg+xml';
}

function normalizeContentType(value: string | null | undefined, fallbackKey?: string) {
	const normalized = String(value || '')
		.trim()
		.split(';')[0]
		.toLowerCase();

	if (normalized.startsWith('image/')) {
		return normalized;
	}

	return inferImageMimeType(fallbackKey || '');
}

function toOutputFormat(contentType: string): OutputImageFormat {
	switch (contentType) {
		case 'image/png':
			return 'image/png';
		case 'image/gif':
			return 'image/gif';
		case 'image/webp':
			return 'image/webp';
		case 'image/avif':
			return 'image/avif';
		default:
			return 'image/jpeg';
	}
}

async function resolveFromRemote(
	bucket: BoundBucket,
	key: string,
	sourceUrl: string
): Promise<ResolvedImageSource> {
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

	const body = await upstream.arrayBuffer();

	if (!body.byteLength) {
		throw error(404, 'Asset not found');
	}

	const contentType = normalizeContentType(upstream.headers.get('content-type'), sourceUrl);

	await bucket.put(key, body, {
		httpMetadata: {
			contentType,
			cacheControl: 'public, max-age=31536000, immutable'
		},
		customMetadata: {
			sourceUrl
		}
	});

	const stream = new Response(body).body;

	if (!stream) {
		throw error(500, 'Asset stream unavailable');
	}

	return {
		body: stream,
		contentType
	};
}

export async function resolveImageSource(
	bucket: BoundBucket,
	key: string,
	sourceUrl?: string | null
): Promise<ResolvedImageSource> {
	const existing = await bucket.get(key);

	if (existing?.body) {
		return {
			body: existing.body,
			contentType: normalizeContentType(existing.httpMetadata?.contentType, key),
			etag: existing.httpEtag
		};
	}

	return resolveFromRemote(bucket, key, String(sourceUrl || '').trim());
}

export async function transformImageWithBinding(
	images: BoundImages,
	source: ResolvedImageSource,
	preset: CfImagePreset
) {
	if (isSvgContentType(source.contentType)) {
		return new Response(source.body, {
			headers: {
				'content-type': source.contentType,
				'cache-control': 'public, max-age=31536000, immutable',
				...(source.etag ? { etag: source.etag } : {})
			}
		});
	}

	const result = await images
		.input(source.body)
		.transform({
			width: preset.width,
			fit: 'scale-down'
		})
		.output({
			format: toOutputFormat(source.contentType),
			quality: preset.quality
		});

	const response = result.response();
	const headers = new Headers(response.headers);
	headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable');
	if (source.etag && !headers.has('etag')) {
		headers.set('etag', source.etag);
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
