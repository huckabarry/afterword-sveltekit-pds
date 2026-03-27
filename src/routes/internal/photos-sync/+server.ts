import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import { runScheduledPhotoSyncBatch } from '$lib/server/photo-manifest';

function getSubmittedSyncToken(request: Request) {
	const authorization = request.headers.get('authorization')?.trim() || '';
	const bearer = authorization.toLowerCase().startsWith('bearer ')
		? authorization.slice(7).trim()
		: '';

	return request.headers.get('x-photo-sync-token')?.trim() || bearer || '';
}

function requirePhotoSyncToken(request: Request) {
	const expected = String(env.PHOTO_SYNC_TOKEN || '').trim();
	const submitted = getSubmittedSyncToken(request);

	if (!expected || !submitted || submitted !== expected) {
		throw error(401, 'Unauthorized');
	}
}

export async function POST(event) {
	requirePhotoSyncToken(event.request);

	const limitParam = Number.parseInt(event.url.searchParams.get('limit') || '12', 10);
	const limit = Number.isFinite(limitParam) ? limitParam : 12;

	try {
		const result = await runScheduledPhotoSyncBatch(event, { limit });
		return json({
			ok: true,
			...result
		});
	} catch (syncError) {
		return json(
			{
				ok: false,
				error:
					syncError instanceof Error
						? syncError.message
						: 'Unable to run scheduled photo sync.'
			},
			{ status: 500 }
		);
	}
}
