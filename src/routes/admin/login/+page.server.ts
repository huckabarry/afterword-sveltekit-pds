import { fail, redirect } from '@sveltejs/kit';
import { createAdminSession, getAdminPassword } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { authenticated } = await parent();

	if (authenticated) {
		throw redirect(303, '/admin');
	}
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const password = String(form.get('password') || '').trim();
		const expected = getAdminPassword();

		if (!expected) {
			return fail(500, { error: 'ADMIN_PASSWORD is not configured' });
		}

		if (password !== expected) {
			return fail(400, { error: 'That password did not match.' });
		}

		await createAdminSession(event.cookies);
		throw redirect(303, '/admin');
	}
};
