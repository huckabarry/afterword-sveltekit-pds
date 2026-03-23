import { redirect } from '@sveltejs/kit';
import { clearAdminSession } from '$lib/server/admin';

export async function POST({ cookies }) {
	clearAdminSession(cookies);
	throw redirect(303, '/admin/login');
}
