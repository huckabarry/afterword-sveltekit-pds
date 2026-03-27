import { json } from '@sveltejs/kit';
import { requireAdminAccess } from '$lib/server/admin';
import { syncPhotoManifestBatch } from '$lib/server/photo-manifest';

export async function POST(event) {
	await requireAdminAccess(event);

	const body = await event.request.json().catch(() => null);
	const offset = Number.parseInt(String(body?.offset || '0'), 10);
	const limit = Number.parseInt(String(body?.limit || '20'), 10);

	try {
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
