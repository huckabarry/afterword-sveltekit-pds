import { json } from '@sveltejs/kit';
import { requireAdminAccess } from '$lib/server/admin';
import { uploadImageFiles } from '$lib/server/media';

export async function POST(event) {
	await requireAdminAccess(event);

	const formData = await event.request.formData().catch(() => null);
	if (!formData) {
		return json({ error: 'Multipart form data is required.' }, { status: 400 });
	}

	const scopeValue = String(formData.get('scope') || 'ap-notes').trim();
	const scope = scopeValue === 'profile' ? 'profile' : 'ap-notes';
	const prefix = String(formData.get('prefix') || '').trim();
	const files = formData
		.getAll('images')
		.filter((item): item is File => item instanceof File && item.size > 0);

	if (!files.length) {
		return json({ error: 'At least one image is required.' }, { status: 400 });
	}

	const uploads = await uploadImageFiles(event, files, {
		scope,
		prefix: prefix || undefined
	});

	return json({ uploads });
}
