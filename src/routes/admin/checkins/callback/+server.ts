import { redirect } from '@sveltejs/kit';
import { requireAdminSession } from '$lib/server/admin';
import { finishSwarmOauth } from '$lib/server/swarm';

export async function GET(event) {
	await requireAdminSession(event);
	await finishSwarmOauth(event);
	throw redirect(303, '/admin/checkins');
}
