import type { PhotoItem } from '$lib/server/ghost';
import {
	inferImageDimensions,
	inferImageMimeType
} from '$lib/server/image-metadata';

type BoundR2Bucket = NonNullable<App.Platform['env']['R2_BUCKET']>;

export type GalleryPhotoItem = PhotoItem & {
	assetKey: string;
	isSyncedToR2: boolean;
	originalUrl: string;
	displayUrl: string;
	lightboxUrl: string;
	width: number | null;
	height: number | null;
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

export function getGalleryVariantPath(assetKey: string, preset: 'thumb' | 'large') {
	return `/${['gallery-images', preset, ...assetKey.split('/').filter(Boolean)].join('/')}`;
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

function parseStoredDimension(value: string | undefined) {
	const parsed = Number.parseInt(String(value || ''), 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toGalleryUrls(photo: PhotoItem, assetKey: string, isSyncedToR2: boolean) {
	return {
		assetKey,
		isSyncedToR2,
		originalUrl: isSyncedToR2 ? getGalleryAssetPath(assetKey) : photo.imageUrl,
		displayUrl: isSyncedToR2 ? getGalleryVariantPath(assetKey, 'thumb') : photo.imageUrl,
		lightboxUrl: isSyncedToR2 ? getGalleryVariantPath(assetKey, 'large') : photo.imageUrl
	};
}

export async function ensureGalleryPhotoAsset(photo: PhotoItem, bucket: BoundR2Bucket) {
	const assetKey = getGalleryAssetKey(photo);
	const existing = await bucket.head(assetKey);
	const existingWidth = parseStoredDimension(existing?.customMetadata?.width);
	const existingHeight = parseStoredDimension(existing?.customMetadata?.height);

	if (existing && existingWidth && existingHeight) {
		return {
			...toGalleryUrls(photo, assetKey, true),
			width: existingWidth,
			height: existingHeight
		};
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
		const contentType =
			response.headers.get('content-type') || inferImageMimeType(photo.imageUrl);
		const dimensions = inferImageDimensions(body, contentType);

		if (!existing || dimensions) {
			await bucket.put(assetKey, body, {
				httpMetadata: {
					contentType,
					cacheControl: 'public, max-age=31536000, immutable'
				},
				customMetadata: {
					sourceUrl: photo.imageUrl,
					postPath: photo.postPath,
					postTitle: photo.postTitle,
					width: dimensions?.width ? String(dimensions.width) : '',
					height: dimensions?.height ? String(dimensions.height) : ''
				}
			});
		}

		return {
			...toGalleryUrls(photo, assetKey, true),
			width: dimensions?.width || existingWidth || null,
			height: dimensions?.height || existingHeight || null
		};
	} catch (error) {
		if (existing) {
			return {
				...toGalleryUrls(photo, assetKey, true),
				width: existingWidth,
				height: existingHeight
			};
		}

		throw error;
	}
}

export async function attachGalleryAssetUrls(photos: PhotoItem[], bucket?: BoundR2Bucket | null) {
	if (!bucket) {
		return photos.map((photo) => ({
			...photo,
			...toGalleryUrls(photo, getGalleryAssetKey(photo), false),
			width: null,
			height: null
		})) satisfies GalleryPhotoItem[];
	}

	const existingKeys = await listExistingGalleryAssetKeys(bucket);

	return photos.map((photo) => {
		const assetKey = getGalleryAssetKey(photo);
		const isSyncedToR2 = existingKeys.has(assetKey);

		return {
			...photo,
			...toGalleryUrls(photo, assetKey, isSyncedToR2),
			width: null,
			height: null
		};
	}) satisfies GalleryPhotoItem[];
}

export async function syncGalleryPhotosToR2(photos: PhotoItem[], bucket: BoundR2Bucket) {
	const uploaded: Array<{ assetKey: string; sourceUrl: string }> = [];
	const skipped: Array<{ assetKey: string; sourceUrl: string }> = [];
	const failed: Array<{ assetKey: string; sourceUrl: string; error: string }> = [];

	for (const photo of photos) {
		const assetKey = getGalleryAssetKey(photo);

		if (await bucket.head(assetKey)) {
			skipped.push({
				assetKey,
				sourceUrl: photo.imageUrl
			});
			continue;
		}

		try {
			await ensureGalleryPhotoAsset(photo, bucket);
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
