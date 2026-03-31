import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import { getMusicImportEntries } from '$lib/server/music';
import { importMusicToPds } from '$lib/server/pds-music';

function getSubmittedSyncToken(request: Request) {
	const authorization = request.headers.get('authorization')?.trim() || '';
	const bearer = authorization.toLowerCase().startsWith('bearer ')
		? authorization.slice(7).trim()
		: '';

	return request.headers.get('x-music-sync-token')?.trim() || bearer || '';
}

function requireMusicSyncToken(request: Request) {
	const expected = String(env.MUSIC_SYNC_TOKEN || '').trim();
	const submitted = getSubmittedSyncToken(request);

	if (!expected || !submitted || submitted !== expected) {
		throw error(401, 'Unauthorized');
	}
}

function normalizeCollections(value: unknown): Array<'tracks' | 'albums'> {
	const values = Array.isArray(value) ? value : [value];
	const collections = values
		.map((entry) =>
			String(entry || '')
				.trim()
				.toLowerCase()
		)
		.filter((entry): entry is 'tracks' | 'albums' => entry === 'tracks' || entry === 'albums');

	return collections.length
		? (Array.from(new Set(collections)) as Array<'tracks' | 'albums'>)
		: ['tracks', 'albums'];
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
	requireMusicSyncToken(event.request);

	const body = await event.request.json().catch(() => ({}));
	const collections = normalizeCollections(body?.collections);
	const limit = normalizeLimit(body?.limit);
	const offset = normalizeOffset(body?.offset);

	try {
		const music = await getMusicImportEntries(event);
		const tracks = collections.includes('tracks') ? music.tracks : [];
		const albums = collections.includes('albums') ? music.albums : [];
		const result = await importMusicToPds({
			tracks,
			albums,
			collections,
			limit,
			offset
		});

		return json({
			archiveDigest: music.archiveDigest,
			...result
		});
	} catch (syncError) {
		return json(
			{
				ok: false,
				error:
					syncError instanceof Error ? syncError.message : 'Unable to sync music data.'
			},
			{ status: 500 }
		);
	}
}
