import type { RequestEvent } from '@sveltejs/kit';

type UploadedMedia = {
	url: string;
	key: string;
	mediaType: string;
	alt: string;
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

function fileExtension(file: File) {
	const namePart = file.name.includes('.') ? file.name.split('.').pop() || '' : '';
	const normalizedName = sanitizeSegment(namePart);

	if (normalizedName) return normalizedName;

	switch (file.type) {
		case 'image/jpeg':
			return 'jpg';
		case 'image/png':
			return 'png';
		case 'image/webp':
			return 'webp';
		case 'image/gif':
			return 'gif';
		default:
			return 'bin';
	}
}

export async function uploadImageFiles(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	files: File[],
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
		if (!(file instanceof File) || file.size === 0) continue;
		if (!file.type.startsWith('image/')) continue;

		const extension = fileExtension(file);
		const key = `${options.scope}/${prefix}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
		const bytes = await file.arrayBuffer();

		await bucket.put(key, bytes, {
			httpMetadata: {
				contentType: file.type
			}
		});

		uploads.push({
			key,
			url: `${event.url.origin}/media/${key}`,
			mediaType: file.type || 'application/octet-stream',
			alt: file.name || ''
		});
	}

	return uploads;
}
