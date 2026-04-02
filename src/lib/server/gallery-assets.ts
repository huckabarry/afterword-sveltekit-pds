import type { PhotoItem } from '$lib/server/ghost';
import {
	resolveImageSource,
	transformImageWithBinding
} from '$lib/server/cloudflare-image-service';
import {
	inferImageDimensions,
	inferImageMimeType
} from '$lib/server/image-metadata';

type BoundR2Bucket = NonNullable<App.Platform['env']['R2_BUCKET']>;
type BoundImages = NonNullable<App.Platform['env']['IMAGES']>;

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
const GALLERY_VARIANT_PREFIX = 'gallery/variants';

export const GALLERY_VARIANT_PRESETS = {
	thumb: {
		width: 900,
		quality: 76
	},
	large: {
		width: 1800,
		quality: 82
	}
} as const;

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

export function getGalleryVariantPath(
	assetKey: string,
	preset: 'thumb' | 'large',
	sourceUrl?: string | null
) {
	const pathname = `/${['gallery-images', preset, ...assetKey.split('/').filter(Boolean)].join('/')}`;
	const normalizedSourceUrl = String(sourceUrl || '').trim();

	return normalizedSourceUrl
		? `${pathname}?src=${encodeURIComponent(normalizedSourceUrl)}`
		: pathname;
}

export function getGalleryVariantAssetKey(assetKey: string, preset: 'thumb' | 'large') {
	const normalizedAssetKey = assetKey.replace(/^gallery\/originals\//, '');
	return `${GALLERY_VARIANT_PREFIX}/${preset}/${normalizedAssetKey}`;
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

export function getGalleryDeliveryUrls(
	assetKey: string,
	sourceUrl: string,
	isSyncedToR2: boolean
) {
	return {
		assetKey,
		isSyncedToR2,
		originalUrl: isSyncedToR2 ? getGalleryAssetPath(assetKey) : sourceUrl,
		displayUrl: isSyncedToR2 ? getGalleryVariantPath(assetKey, 'thumb', sourceUrl) : sourceUrl,
		lightboxUrl: isSyncedToR2 ? getGalleryVariantPath(assetKey, 'large', sourceUrl) : sourceUrl
	};
}

function toGalleryUrls(photo: PhotoItem, assetKey: string, isSyncedToR2: boolean) {
	return getGalleryDeliveryUrls(assetKey, photo.imageUrl, isSyncedToR2);
}

export async function ensureGalleryPhotoAsset(photo: PhotoItem, bucket: BoundR2Bucket) {
	const assetKey = getGalleryAssetKey(photo);
	const existing = await bucket.head(assetKey);
	const existingWidth = parseStoredDimension(existing?.customMetadata?.width);
	const existingHeight = parseStoredDimension(existing?.customMetadata?.height);

	if (existing && existingWidth && existingHeight) {
		return {
			...toGalleryUrls(photo, assetKey, true),
			width: existingWidth || photo.width || null,
			height: existingHeight || photo.height || null
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
			width: dimensions?.width || existingWidth || photo.width || null,
			height: dimensions?.height || existingHeight || photo.height || null
		};
	} catch (error) {
		if (existing) {
			return {
				...toGalleryUrls(photo, assetKey, true),
				width: existingWidth || photo.width || null,
				height: existingHeight || photo.height || null
			};
		}

		throw error;
	}
}

export async function ensureGalleryPhotoVariant(
	bucket: BoundR2Bucket,
	images: BoundImages,
	assetKey: string,
	preset: 'thumb' | 'large'
) {
	const variantKey = getGalleryVariantAssetKey(assetKey, preset);
	const existing = await bucket.get(variantKey);

	if (existing) {
		return variantKey;
	}

	const transformed = await transformImageWithBinding(
		images,
		await resolveImageSource(bucket, assetKey),
		GALLERY_VARIANT_PRESETS[preset]
	);
	const contentType = transformed.headers.get('content-type') || inferImageMimeType(variantKey);
	const body = await transformed.arrayBuffer();

	if (!body.byteLength) {
		throw new Error(`Generated ${preset} gallery variant is empty.`);
	}

	await bucket.put(variantKey, body, {
		httpMetadata: {
			contentType,
			cacheControl: 'public, max-age=31536000, immutable'
		},
		customMetadata: {
			sourceAssetKey: assetKey,
			preset
		}
	});

	return variantKey;
}

export async function ensureGalleryPhotoVariants(
	bucket: BoundR2Bucket,
	images: BoundImages,
	assetKey: string
) {
	await Promise.all([
		ensureGalleryPhotoVariant(bucket, images, assetKey, 'thumb'),
		ensureGalleryPhotoVariant(bucket, images, assetKey, 'large')
	]);
}

export async function attachGalleryAssetUrls(photos: PhotoItem[], bucket?: BoundR2Bucket | null) {
	if (!bucket) {
		return photos.map((photo) => ({
			...photo,
			...toGalleryUrls(photo, getGalleryAssetKey(photo), false),
			width: photo.width || null,
			height: photo.height || null
		})) satisfies GalleryPhotoItem[];
	}

	const existingKeys = await listExistingGalleryAssetKeys(bucket);

	return photos.map((photo) => {
		const assetKey = getGalleryAssetKey(photo);
		const isSyncedToR2 = existingKeys.has(assetKey);

		return {
			...photo,
			...toGalleryUrls(photo, assetKey, isSyncedToR2),
			width: photo.width || null,
			height: photo.height || null
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
