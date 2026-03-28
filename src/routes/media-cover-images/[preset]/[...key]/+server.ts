import { error } from '@sveltejs/kit';

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

	if (isSvgAsset(key)) {
		const originUrl = new URL(
			`/${['media-cover-assets', ...key.split('/').filter(Boolean)].join('/')}`,
			event.url
		);
		originUrl.search = event.url.search;

		return fetch(originUrl);
	}

	const originUrl = new URL(
		`/${['media-cover-assets', ...key.split('/').filter(Boolean)].join('/')}`,
		event.url
	);
	originUrl.search = event.url.search;

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
	headers.set(
		'cache-control',
		headers.get('cache-control') || 'public, max-age=31536000, immutable'
	);

	return new Response(transformed.body, {
		status: transformed.status,
		headers
	});
}
