import { json } from '@sveltejs/kit';
import { requireAdminAccess } from '$lib/server/admin';
import {
	syncGhostPostPhotoManifestBySlug,
	syncPhotoManifestBatch
} from '$lib/server/photo-manifest';

export async function POST(event) {
	await requireAdminAccess(event);

	const body = await event.request.json().catch(() => null);
	const slug = String(body?.slug || '').trim();
	const offset = Number.parseInt(String(body?.offset || '0'), 10);
	const limit = Number.parseInt(String(body?.limit || '20'), 10);

	try {
		if (slug) {
			const result = await syncGhostPostPhotoManifestBySlug(event, slug);
			return json({
				ok: true,
				...result,
				mode: 'slug'
			});
		}

		const result = await syncPhotoManifestBatch(event, {
			offset: Number.isFinite(offset) ? offset : 0,
			limit: Number.isFinite(limit) ? limit : 20
		});
		return json({
			ok: true,
			...result
		});
	} catch (error) {
		return json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Unable to sync photo manifest.'
			},
			{ status: 500 }
		);
	}
}
