import { requireAdminSession } from '$lib/server/admin';
import { startSwarmOauth } from '$lib/server/swarm';

export async function GET(event) {
	await requireAdminSession(event);
	return startSwarmOauth(event);
}
