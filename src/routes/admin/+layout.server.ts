import { redirect } from '@sveltejs/kit';
import { hasAdminSession } from '$lib/server/admin';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const authenticated = await hasAdminSession(event.cookies);

	if (!authenticated && event.url.pathname !== '/admin/login') {
		throw redirect(303, '/admin/login');
	}

	return {
		authenticated,
		pathname: event.url.pathname
	};
};
