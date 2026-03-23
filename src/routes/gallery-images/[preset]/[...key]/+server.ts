import { error } from '@sveltejs/kit';

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

type CfImageRequestInit = RequestInit & {
	cf?: {
		image?: {
			width?: number;
			fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
			quality?: number;
			metadata?: 'none' | 'keep' | 'copyright';
		};
	};
};

function isSvgAsset(key: string) {
	return /\.svg$/i.test(key);
}

export async function GET(event) {
	const bucket = event.platform?.env.R2_BUCKET;

	if (!bucket) {
		throw error(500, 'R2_BUCKET is not configured');
	}

	const key = event.params.key;
	const preset = event.params.preset as keyof typeof PRESETS;

	if (!key || !PRESETS[preset]) {
		throw error(404, 'Asset not found');
	}

	const object = await bucket.get(key);

	if (!object) {
		throw error(404, 'Asset not found');
	}

	if (isSvgAsset(key)) {
		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set('etag', object.httpEtag);
		headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable');

		return new Response(object.body, {
			headers
		});
	}

	const originUrl = new URL(`/${['gallery-assets', ...key.split('/').filter(Boolean)].join('/')}`, event.url);
	const imageRequest: CfImageRequestInit = {
		cf: {
			image: {
				width: PRESETS[preset].width,
				fit: 'scale-down',
				quality: PRESETS[preset].quality,
				metadata: 'none'
			}
		}
	};

	const transformed = await fetch(originUrl, imageRequest as RequestInit);

	if (!transformed.ok) {
		throw error(transformed.status, 'Image transform failed');
	}

	const headers = new Headers(transformed.headers);
	headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable');

	return new Response(transformed.body, {
		status: transformed.status,
		headers
	});
}
