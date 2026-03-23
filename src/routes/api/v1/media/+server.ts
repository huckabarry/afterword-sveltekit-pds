import { json, type RequestEvent } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { encodeMastodonMediaId } from '$lib/server/mastodon-api';
import { uploadImageFiles } from '$lib/server/media';

async function handleUpload(event: Pick<RequestEvent, 'platform' | 'request' | 'url'>) {
	await requireMastodonAccessToken(event);
	const formData = await event.request.formData().catch(() => null);

	if (!formData) {
		return json({ error: 'Multipart form data is required.' }, { status: 400 });
	}

	const files = formData
		.getAll('file')
		.filter((item: FormDataEntryValue): item is File => item instanceof File && item.size > 0);

	if (!files.length) {
		return json({ error: 'A file is required.' }, { status: 422 });
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
