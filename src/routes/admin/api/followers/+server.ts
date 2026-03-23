import { json } from '@sveltejs/kit';
import { requireAdminAccess } from '$lib/server/admin';
import { listFollowers } from '$lib/server/followers';

export async function GET(event) {
	await requireAdminAccess(event);

	const followers = await listFollowers(event);
	return json({
		followers: followers.map((follower) => ({
			id: follower.id,
			actorId: follower.actorId,
			inboxUrl: follower.inboxUrl,
			sharedInboxUrl: follower.sharedInboxUrl,
			displayName: follower.displayName,
			handle: follower.handle,
			acceptedAt: follower.acceptedAt,
			lastDeliveryAt: follower.lastDeliveryAt,
			lastDeliveryStatus: follower.lastDeliveryStatus
		}))
	});
}
