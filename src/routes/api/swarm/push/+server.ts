import { json } from '@sveltejs/kit';
import { handleSwarmPush, syncSingleSwarmCheckin } from '$lib/server/swarm';

export async function POST(event) {
	const checkin = await handleSwarmPush(event);

	if (!checkin) {
		return json({ ok: true, queued: false });
	}

	const work = syncSingleSwarmCheckin(event, checkin).catch((pushError) => {
		console.error('[swarm] Push sync failed:', pushError);
	});

	event.platform?.ctx.waitUntil(work);
	return json({ ok: true, queued: true });
}
