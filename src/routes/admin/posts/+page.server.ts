import { buildAdminPostFeed } from '$lib/server/admin-posts';
import { requireAdminSession } from '$lib/server/admin';
import { deleteStatusRecord, getStatusRecordKey, updateStatusText } from '$lib/server/pds-status';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireAdminSession(event);

	return {
		posts: await buildAdminPostFeed()
	};
};

export const actions: Actions = {
	update: async (event) => {
		await requireAdminSession(event);

		const formData = await event.request.formData();
		const uri = String(formData.get('uri') || '').trim();
		const text = String(formData.get('text') || '');

		if (!uri) {
			return fail(400, {
				ok: false,
				message: 'Missing Bluesky post URI.'
			});
		}

		try {
			const rkey = getStatusRecordKey(uri);
			await updateStatusText(rkey, text);
			return {
				ok: true,
				message: 'Bluesky post updated.'
			};
		} catch (editError) {
			return fail(500, {
				ok: false,
				message: editError instanceof Error ? editError.message : 'Unable to update Bluesky post.'
			});
		}
	},
	delete: async (event) => {
		await requireAdminSession(event);

		const formData = await event.request.formData();
		const uri = String(formData.get('uri') || '').trim();

		if (!uri) {
			return fail(400, {
				ok: false,
				message: 'Missing Bluesky post URI.'
			});
		}

		try {
			const rkey = getStatusRecordKey(uri);
			await deleteStatusRecord(rkey);
			return {
				ok: true,
				message: 'Bluesky post deleted.'
			};
		} catch (deleteError) {
			return fail(500, {
				ok: false,
				message:
					deleteError instanceof Error ? deleteError.message : 'Unable to delete Bluesky post.'
			});
		}
	}
};
