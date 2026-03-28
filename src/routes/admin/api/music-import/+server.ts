import { json } from '@sveltejs/kit';
import { requireAdminAccess } from '$lib/server/admin';
import { getArchiveAlbums, getArchiveTracks } from '$lib/server/music';
import { importMusicToPds } from '$lib/server/pds-music';

function normalizeCollections(value: unknown) {
	const values = Array.isArray(value) ? value : [value];
	const collections = values
		.map((entry) =>
			String(entry || '')
				.trim()
				.toLowerCase()
		)
		.filter((entry): entry is 'tracks' | 'albums' => entry === 'tracks' || entry === 'albums');

	return collections.length ? [...new Set(collections)] : ['tracks', 'albums'];
}

function normalizeLimit(value: unknown) {
	const parsed = Number.parseInt(String(value || ''), 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeOffset(value: unknown) {
	const parsed = Number.parseInt(String(value || ''), 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function POST(event) {
	await requireAdminAccess(event);

	const body = await event.request.json().catch(() => ({}));
	const collections = normalizeCollections(body?.collections);
	const limit = normalizeLimit(body?.limit);
	const offset = normalizeOffset(body?.offset);

	const [tracks, albums] = await Promise.all([
		collections.includes('tracks') ? getArchiveTracks() : Promise.resolve([]),
		collections.includes('albums') ? getArchiveAlbums() : Promise.resolve([])
	]);

	try {
		const result = await importMusicToPds({
			tracks,
			albums,
			collections,
			limit,
			offset
		});

		return json({
			ok: result.ok,
			...result
		});
	} catch (error) {
		return json(
			{
				ok: false,
				collections,
				limit,
				offset,
				error: error instanceof Error ? error.message : 'Unable to import music records.'
			},
			{ status: 500 }
		);
	}
}
