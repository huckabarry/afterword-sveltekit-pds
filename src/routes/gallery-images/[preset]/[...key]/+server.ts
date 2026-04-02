import { error } from '@sveltejs/kit';
import {
	GALLERY_VARIANT_PRESETS,
	getGalleryVariantAssetKey
} from '$lib/server/gallery-assets';
import {
	resolveImageSource,
	transformImageWithBinding
} from '$lib/server/cloudflare-image-service';
import { cacheImageResponse, matchCachedImage } from '$lib/server/worker-image-cache';

export async function GET(event) {
	const cached = await matchCachedImage(event.request);

	if (cached) {
		return cached;
	}

	const bucket = event.platform?.env.R2_BUCKET;
	const images = event.platform?.env.IMAGES;

	if (!bucket || !images) {
		throw error(500, 'Image bindings are not configured');
	}

	const key = event.params.key;
	const preset = event.params.preset as keyof typeof GALLERY_VARIANT_PRESETS;

	if (!key || !GALLERY_VARIANT_PRESETS[preset]) {
		throw error(404, 'Asset not found');
	}

	const variantKey = getGalleryVariantAssetKey(key, preset);
	const existingVariant = await bucket.get(variantKey);

	if (existingVariant) {
		const headers = new Headers();
		existingVariant.writeHttpMetadata(headers);
		headers.set('etag', existingVariant.httpEtag);
		headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable');

		return cacheImageResponse(
			event.request,
			new Response(existingVariant.body, { headers }),
			event.platform?.ctx
		);
	}

	const source = await resolveImageSource(bucket, key);
	const transformed = await transformImageWithBinding(images, source, GALLERY_VARIANT_PRESETS[preset]);
	const transformedBody = await transformed.clone().arrayBuffer();

	if (transformedBody.byteLength) {
		await bucket.put(variantKey, transformedBody, {
			httpMetadata: {
				contentType: transformed.headers.get('content-type') || 'image/jpeg',
				cacheControl: 'public, max-age=31536000, immutable'
			},
			customMetadata: {
				sourceAssetKey: key,
				preset
			}
		});
	}

	return cacheImageResponse(
		event.request,
		transformed,
		event.platform?.ctx
	);
}
