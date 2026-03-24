import { json, type RequestEvent } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { encodeMastodonMediaId } from '$lib/server/mastodon-api';
import { uploadImageFiles } from '$lib/server/media';

type FileLike = {
	name?: string;
	type?: string;
	size?: number;
	arrayBuffer: () => Promise<ArrayBuffer>;
};

function isFileLike(value: unknown): value is FileLike {
	if (!value || typeof value !== 'object') return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.arrayBuffer === 'function' &&
		typeof record.size === 'number' &&
		typeof record.type === 'string'
	);
}

function collectFiles(formData: FormData) {
	const keys = ['file', 'file[]', 'files', 'files[]', 'media', 'media[]'];
	const entries: FileLike[] = [];

	for (const key of keys) {
		for (const item of formData.getAll(key)) {
			if (isFileLike(item) && Number(item.size || 0) > 0) {
				entries.push(item);
			}
		}
	}

	// Some clients send a single unnamed/blob part under an unexpected field name.
	if (!entries.length) {
		for (const [, value] of formData.entries()) {
			if (isFileLike(value) && Number(value.size || 0) > 0) {
				entries.push(value);
			}
		}
	}

	return entries;
}

async function handleUpload(event: Pick<RequestEvent, 'platform' | 'request' | 'url'>) {
	await requireMastodonAccessToken(event);
	const formData = await event.request.formData().catch(() => null);

	if (!formData) {
		return json({ error: 'Multipart form data is required.' }, { status: 400 });
	}

	const files = collectFiles(formData);

	if (!files.length) {
		return json(
			{
				error: 'A file is required.',
				debug: {
					keys: Array.from(new Set(Array.from(formData.keys())))
				}
			},
			{ status: 422 }
		);
	}

	const uploads = await uploadImageFiles(event, [files[0]], {
		scope: 'ap-notes',
		prefix: 'mastodon'
	});

	const upload = uploads[0];
	if (!upload) {
		return json({ error: 'Unable to upload file.' }, { status: 500 });
	}

	return json({
		id: encodeMastodonMediaId(upload.key),
		type: 'image',
		url: upload.url,
		preview_url: upload.url,
		remote_url: null,
		meta: null,
		description: String(formData.get('description') || '').trim() || null,
		blurhash: null
	});
}

export function POST(event: Parameters<typeof handleUpload>[0]) {
	return handleUpload(event);
}
