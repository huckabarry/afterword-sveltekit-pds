import type { PhotoItem } from '$lib/server/ghost';

type BoundR2Bucket = NonNullable<App.Platform['env']['R2_BUCKET']>;

export type GalleryPhotoItem = PhotoItem & {
	assetKey: string;
	displayUrl: string;
	isSyncedToR2: boolean;
};

const GALLERY_PREFIX = 'gallery/originals';

function sanitizeSegment(value: string) {
	return String(value || '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'item';
}

function inferExtensionFromUrl(imageUrl: string) {
	try {
		const pathname = new URL(imageUrl).pathname;
		const ext = pathname.split('.').pop()?.toLowerCase() || '';

		if (/^(avif|gif|jpe?g|png|svg|webp)$/i.test(ext)) {
			return ext === 'jpeg' ? 'jpg' : ext;
		}
	} catch {
		// ignore malformed URLs and fall through to jpg
	}

	return 'jpg';
}

export function getGalleryAssetKey(photo: PhotoItem) {
	const postSlug = sanitizeSegment(photo.postPath.split('/').filter(Boolean).pop() || photo.postId);
	const imageSlug = sanitizeSegment(`${photo.index < 0 ? 'cover' : `image-${photo.index}`}`);
	const extension = inferExtensionFromUrl(photo.imageUrl);
	return `${GALLERY_PREFIX}/${postSlug}/${imageSlug}.${extension}`;
}

export function getGalleryAssetPath(assetKey: string) {
	return `/${['gallery-assets', ...assetKey.split('/').filter(Boolean)].join('/')}`;
}

async function listExistingGalleryAssetKeys(bucket: BoundR2Bucket) {
	const keys = new Set<string>();
	let cursor: string | undefined;

	do {
		const page = await bucket.list({
			prefix: `${GALLERY_PREFIX}/`,
			cursor
		});

		for (const object of page.objects) {
			keys.add(object.key);
		}

		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);

	return keys;
}

export async function attachGalleryAssetUrls(photos: PhotoItem[], bucket?: BoundR2Bucket | null) {
	if (!bucket) {
		return photos.map((photo) => ({
			...photo,
			assetKey: getGalleryAssetKey(photo),
			displayUrl: photo.imageUrl,
			isSyncedToR2: false
		})) satisfies GalleryPhotoItem[];
	}

	const existingKeys = await listExistingGalleryAssetKeys(bucket);

	return photos.map((photo) => {
		const assetKey = getGalleryAssetKey(photo);
		const isSyncedToR2 = existingKeys.has(assetKey);

		return {
			...photo,
			assetKey,
			displayUrl: isSyncedToR2 ? getGalleryAssetPath(assetKey) : photo.imageUrl,
			isSyncedToR2
		};
	}) satisfies GalleryPhotoItem[];
}

export async function syncGalleryPhotosToR2(photos: PhotoItem[], bucket: BoundR2Bucket) {
	const existingKeys = await listExistingGalleryAssetKeys(bucket);
	const uploaded: Array<{ assetKey: string; sourceUrl: string }> = [];
	const skipped: Array<{ assetKey: string; sourceUrl: string }> = [];
	const failed: Array<{ assetKey: string; sourceUrl: string; error: string }> = [];

	for (const photo of photos) {
		const assetKey = getGalleryAssetKey(photo);

		if (existingKeys.has(assetKey)) {
			skipped.push({
				assetKey,
				sourceUrl: photo.imageUrl
			});
			continue;
		}

		try {
			const response = await fetch(photo.imageUrl, {
				headers: {
					Accept: 'image/*'
				}
			});

			if (!response.ok) {
				throw new Error(`Source fetch failed with ${response.status}`);
			}

			const body = await response.arrayBuffer();
			const contentType = response.headers.get('content-type') || 'application/octet-stream';

			await bucket.put(assetKey, body, {
				httpMetadata: {
					contentType,
					cacheControl: 'public, max-age=31536000, immutable'
				},
				customMetadata: {
					sourceUrl: photo.imageUrl,
					postPath: photo.postPath,
					postTitle: photo.postTitle
				}
			});

			existingKeys.add(assetKey);
			uploaded.push({
				assetKey,
				sourceUrl: photo.imageUrl
			});
		} catch (error) {
			failed.push({
				assetKey,
				sourceUrl: photo.imageUrl,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	return {
		scanned: photos.length,
		uploaded,
		skipped,
		failed
	};
}
