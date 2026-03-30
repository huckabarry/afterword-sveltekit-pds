import { fail } from '@sveltejs/kit';
import {
	deleteWebmention,
	listRecentWebmentions,
	updateWebmentionStatus
} from '$lib/server/webmentions';
import { requireAdminSession } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireAdminSession(event);

	return {
		webmentions: await listRecentWebmentions(event, 100)
	};
};

export const actions: Actions = {
	update: async (event) => {
		await requireAdminSession(event);

		const form = await event.request.formData();
		const id = Number(form.get('id') || 0);
		const status = String(form.get('status') || '').trim();

		if (!id || !status) {
			return fail(400, { error: 'Missing webmention action' });
		}

		await updateWebmentionStatus(event, id, status);
		return { ok: true };
	},
	delete: async (event) => {
		await requireAdminSession(event);

		const form = await event.request.formData();
		const id = Number(form.get('id') || 0);

		if (!id) {
			return fail(400, { error: 'Missing webmention id' });
		}

		await deleteWebmention(event, id);
		return { ok: true };
	}
};
