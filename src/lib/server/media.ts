import type { RequestEvent } from '@sveltejs/kit';

type UploadedMedia = {
	url: string;
	key: string;
	mediaType: string;
	alt: string;
};

type FileLike = {
	name?: string;
	type?: string;
	size?: number;
	arrayBuffer: () => Promise<ArrayBuffer>;
};

function getBucket(event: Pick<RequestEvent, 'platform'>) {
	return event.platform?.env?.R2_BUCKET ?? null;
}

function sanitizeSegment(value: string) {
	return String(value || '')
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function isFileLike(value: unknown): value is FileLike {
	if (!value || typeof value !== 'object') return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.arrayBuffer === 'function' &&
		('size' in record ? typeof record.size === 'number' || typeof record.size === 'string' : true) &&
		('type' in record ? typeof record.type === 'string' : true)
	);
}

function fileExtension(file: FileLike) {
	const name = String(file.name || '');
	const namePart = name.includes('.') ? name.split('.').pop() || '' : '';
	const normalizedName = sanitizeSegment(namePart);

	if (normalizedName) return normalizedName;

	switch (String(file.type || '')) {
		case 'image/jpeg':
			return 'jpg';
		case 'image/png':
			return 'png';
		case 'image/webp':
			return 'webp';
		case 'image/gif':
			return 'gif';
		default:
			if (/\.(jpe?g)$/i.test(name)) return 'jpg';
			if (/\.png$/i.test(name)) return 'png';
			if (/\.webp$/i.test(name)) return 'webp';
			if (/\.gif$/i.test(name)) return 'gif';
			return 'bin';
	}
}

export async function uploadImageFiles(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	files: FileLike[],
	options: {
		scope: 'ap-notes' | 'profile';
		prefix?: string;
	}
): Promise<UploadedMedia[]> {
	const bucket = getBucket(event);
	if (!bucket || !files.length) return [];

	const uploads: UploadedMedia[] = [];
	const prefix = sanitizeSegment(options.prefix || 'item') || 'item';

	for (const file of files) {
		if (!isFileLike(file) || Number(file.size || 1) === 0) continue;

		const contentType = String(file.type || '').trim();
		const extension = fileExtension(file);
		const looksLikeImage =
			contentType.startsWith('image/') || ['jpg', 'png', 'webp', 'gif'].includes(extension);

		if (!looksLikeImage) continue;

		const key = `${options.scope}/${prefix}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
		const bytes = await file.arrayBuffer();

		await bucket.put(key, bytes, {
			httpMetadata: {
				contentType: contentType || `image/${extension === 'jpg' ? 'jpeg' : extension}`
			}
		});

		uploads.push({
			key,
			url: `${event.url.origin}/media/${key}`,
			mediaType: contentType || `image/${extension === 'jpg' ? 'jpeg' : extension}`,
			alt: String(file.name || '')
		});
	}

	return uploads;
}

function guessExtensionFromUrl(url: string) {
	try {
		const pathname = new URL(url).pathname;
		const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
		if (!match) return '';
		return sanitizeSegment(match[1] || '');
	} catch {
		return '';
	}
}

export async function uploadRemoteImageUrls(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	urls: string[],
	options: {
		scope: 'ap-notes' | 'profile';
		prefix?: string;
	}
): Promise<UploadedMedia[]> {
	const bucket = getBucket(event);
	if (!bucket || !urls.length) return [];

	const uploads: UploadedMedia[] = [];
	const prefix = sanitizeSegment(options.prefix || 'item') || 'item';

	for (const inputUrl of urls) {
		const remoteUrl = String(inputUrl || '').trim();
		if (!remoteUrl) continue;

		try {
			const response = await fetch(remoteUrl, {
				headers: {
					Accept: 'image/*,*/*;q=0.8'
				}
			});
			if (!response.ok) continue;

			const contentType = String(response.headers.get('content-type') || '').trim();
			const extension =
				guessExtensionFromUrl(remoteUrl) ||
				(contentType === 'image/jpeg'
					? 'jpg'
					: contentType === 'image/png'
						? 'png'
						: contentType === 'image/webp'
							? 'webp'
							: contentType === 'image/gif'
								? 'gif'
								: '');
			const looksLikeImage =
				contentType.startsWith('image/') || ['jpg', 'png', 'webp', 'gif'].includes(extension);
			if (!looksLikeImage) continue;

			const bytes = await response.arrayBuffer();
			if (!bytes.byteLength) continue;

			const key = `${options.scope}/${prefix}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${extension || 'jpg'}`;
			await bucket.put(key, bytes, {
				httpMetadata: {
					contentType: contentType || `image/${extension === 'jpg' ? 'jpeg' : extension || 'jpeg'}`
				}
			});

			uploads.push({
				key,
				url: `${event.url.origin}/media/${key}`,
				mediaType: contentType || `image/${extension === 'jpg' ? 'jpeg' : extension || 'jpeg'}`,
				alt: ''
			});
		} catch {
			continue;
		}
	}

	return uploads;
}
