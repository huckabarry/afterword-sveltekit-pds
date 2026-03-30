import { json } from '@sveltejs/kit';
import { requireSwarmSyncToken, syncRecentSwarmCheckins } from '$lib/server/swarm';

export async function POST(event) {
	requireSwarmSyncToken(event.request);

	const limitParam = Number.parseInt(event.url.searchParams.get('limit') || '50', 10);
	const limit = Number.isFinite(limitParam) ? limitParam : 50;

	try {
		const result = await syncRecentSwarmCheckins(event, { limit });
		return json({
			...result,
			ok: result.ok
		});
	} catch (syncError) {
		return json(
			{
				ok: false,
				error:
					syncError instanceof Error
						? syncError.message
						: 'Unable to run Swarm check-in sync.'
			},
			{ status: 500 }
		);
	}
}
