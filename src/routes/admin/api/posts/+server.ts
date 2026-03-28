import { json } from '@sveltejs/kit';
import { requireAdminAccess } from '$lib/server/admin';
import { buildAdminPostFeed } from '$lib/server/admin-posts';

export async function GET(event) {
	await requireAdminAccess(event);

	return json({
		posts: await buildAdminPostFeed()
	});
}
