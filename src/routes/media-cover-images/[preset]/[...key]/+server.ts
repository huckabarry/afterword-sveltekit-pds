import { error } from '@sveltejs/kit';
import {
	resolveImageSource,
	transformImageWithBinding
} from '$lib/server/cloudflare-image-service';
import { cacheImageResponse, matchCachedImage } from '$lib/server/worker-image-cache';

const PRESETS = {
	mini: {
		width: 320,
		quality: 74
	},
	cover: {
		width: 1400,
		quality: 86
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

	const transformed = await transformImageWithBinding(
		images,
		await resolveImageSource(bucket, key, event.url.searchParams.get('src')),
		PRESETS[preset]
	);

	return cacheImageResponse(
		event.request,
		transformed,
		event.platform?.ctx
	);
}
