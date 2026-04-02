import { error } from '@sveltejs/kit';
import {
	resolveImageSource,
	transformImageWithBinding
} from '$lib/server/cloudflare-image-service';
import { cacheImageResponse, matchCachedImage } from '$lib/server/worker-image-cache';

const PRESETS = {
	thumb: {
		width: 900,
		quality: 76
	},
	large: {
		width: 1800,
		quality: 82
	}
} as const;

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
	const preset = event.params.preset as keyof typeof PRESETS;

	if (!key || !PRESETS[preset]) {
		throw error(404, 'Asset not found');
	}

	const source = await resolveImageSource(bucket, key);
	const transformed = await transformImageWithBinding(images, source, PRESETS[preset]);

	return cacheImageResponse(
		event.request,
		transformed,
		event.platform?.ctx
	);
}
