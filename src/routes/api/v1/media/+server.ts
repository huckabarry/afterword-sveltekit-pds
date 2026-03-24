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

type MultipartPart = {
	name: string | null;
	filename: string | null;
	contentType: string | null;
	data: Uint8Array;
};

function isFileLike(value: unknown): value is FileLike {
	if (!value || typeof value !== 'object') return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.arrayBuffer === 'function' &&
		('size' in record ? typeof record.size === 'number' || typeof record.size === 'string' : true) &&
		('type' in record ? typeof record.type === 'string' : true)
	);
}

function parseHeaderAttributes(header: string) {
	const attributes = new Map<string, string>();
	for (const segment of header.split(';').slice(1)) {
		const [rawKey, ...rawValue] = segment.split('=');
		const key = String(rawKey || '').trim().toLowerCase();
		if (!key) continue;
		const value = rawValue.join('=').trim().replace(/^"|"$/g, '');
		attributes.set(key, value);
	}
	return attributes;
}

function parseMultipartBoundary(contentType: string) {
	const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
	return match?.[1] || match?.[2] || null;
}

function toUtf8String(bytes: Uint8Array) {
	return new TextDecoder().decode(bytes);
}

function sliceTrimCrlf(bytes: Uint8Array) {
	let start = 0;
	let end = bytes.length;
	if (bytes[start] === 13 && bytes[start + 1] === 10) start += 2;
	if (bytes[end - 2] === 13 && bytes[end - 1] === 10) end -= 2;
	return bytes.slice(start, end);
}

function parseMultipartParts(body: Uint8Array, boundary: string): MultipartPart[] {
	const delimiter = new TextEncoder().encode(`--${boundary}`);
	const parts: MultipartPart[] = [];
	let index = 0;

	while (index < body.length) {
		const boundaryIndex = body.indexOf(delimiter[0], index);
		if (boundaryIndex === -1) break;
		const candidate = body.slice(boundaryIndex, boundaryIndex + delimiter.length);
		if (!candidate.every((byte, i) => byte === delimiter[i])) {
			index = boundaryIndex + 1;
			continue;
		}

		let cursor = boundaryIndex + delimiter.length;
		if (body[cursor] === 45 && body[cursor + 1] === 45) break;
		if (body[cursor] === 13 && body[cursor + 1] === 10) cursor += 2;

		const nextBoundaryIndex = (() => {
			for (let i = cursor; i < body.length - delimiter.length; i += 1) {
				if (body[i] !== 13 || body[i + 1] !== 10) continue;
				let matches = true;
				for (let j = 0; j < delimiter.length; j += 1) {
					if (body[i + 2 + j] !== delimiter[j]) {
						matches = false;
						break;
					}
				}
				if (matches) return i;
			}
			return body.length;
		})();

		const chunk = sliceTrimCrlf(body.slice(cursor, nextBoundaryIndex));
		const separator = chunk.indexOf(13);
		const headerEnd = (() => {
			for (let i = 0; i < chunk.length - 3; i += 1) {
				if (chunk[i] === 13 && chunk[i + 1] === 10 && chunk[i + 2] === 13 && chunk[i + 3] === 10) {
					return i;
				}
			}
			return -1;
		})();
		if (headerEnd === -1) {
			index = nextBoundaryIndex + 2;
			continue;
		}

		const headerBlock = toUtf8String(chunk.slice(0, headerEnd));
		const data = chunk.slice(headerEnd + 4);
		const headers = headerBlock.split('\r\n');
		const disposition = headers.find((line) => /^content-disposition:/i.test(line));
		if (!disposition) {
			index = nextBoundaryIndex + 2;
			continue;
		}

		const dispositionValue = disposition.slice(disposition.indexOf(':') + 1).trim();
		const attrs = parseHeaderAttributes(dispositionValue);
		const contentTypeHeader = headers.find((line) => /^content-type:/i.test(line));
		const contentType = contentTypeHeader
			? contentTypeHeader.slice(contentTypeHeader.indexOf(':') + 1).trim()
			: null;

		parts.push({
			name: attrs.get('name') || null,
			filename: attrs.get('filename') || null,
			contentType,
			data
		});

		index = nextBoundaryIndex + 2;
	}

	return parts;
}

function partToFileLike(part: MultipartPart): FileLike | null {
	const contentType = String(part.contentType || '').trim();
	const filename = String(part.filename || '').trim();
	const key = String(part.name || '').trim();
	const looksLikeImage =
		contentType.startsWith('image/') ||
		['file', 'file[]', 'files', 'files[]', 'media', 'media[]'].includes(key);

	if (!looksLikeImage || !part.data.length) return null;

	return {
		name: filename || `${key || 'upload'}.bin`,
		type: contentType || 'application/octet-stream',
		size: part.data.length,
		arrayBuffer: async () => {
			const copy = new Uint8Array(part.data.byteLength);
			copy.set(part.data);
			return copy.buffer;
		}
	};
}

function collectFiles(formData: FormData) {
	const keys = ['file', 'file[]', 'files', 'files[]', 'media', 'media[]'];
	const entries: FileLike[] = [];

	for (const key of keys) {
		for (const item of formData.getAll(key)) {
			if (isFileLike(item) && Number(item.size || 1) > 0) {
				entries.push(item);
			}
		}
	}

	// Some clients send a single unnamed/blob part under an unexpected field name.
	if (!entries.length) {
		for (const [, value] of formData.entries()) {
			if (isFileLike(value) && Number(value.size || 1) > 0) {
				entries.push(value);
			}
		}
	}

	return entries;
}

async function handleUpload(event: Pick<RequestEvent, 'platform' | 'request' | 'url'>) {
	await requireMastodonAccessToken(event);
	const requestClone = event.request.clone();
	const contentType = event.request.headers.get('content-type') || '';
	const formData = await event.request.formData().catch(() => null);

	if (!formData) {
		return json({ error: 'Multipart form data is required.' }, { status: 400 });
	}

	let files = collectFiles(formData);

	if (!files.length && contentType.includes('multipart/form-data')) {
		const boundary = parseMultipartBoundary(contentType);
		if (boundary) {
			const bytes = new Uint8Array(await requestClone.arrayBuffer().catch(() => new ArrayBuffer(0)));
			const fallbackFiles = parseMultipartParts(bytes, boundary)
				.map(partToFileLike)
				.filter((item): item is FileLike => Boolean(item));
			if (fallbackFiles.length) {
				files = fallbackFiles;
			}
		}
	}

	if (!files.length) {
		return json(
			{
				error: 'A file is required.',
				debug: {
					keys: Array.from(new Set(Array.from(formData.keys()))),
					contentType
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
