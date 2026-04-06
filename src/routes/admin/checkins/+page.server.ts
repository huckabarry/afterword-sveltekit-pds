import { clearSwarmConnection, getSwarmSyncStateView, syncRecentSwarmCheckins } from '$lib/server/swarm';
import { requireAdminSession } from '$lib/server/admin';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireAdminSession(event);

	return {
		swarm: await getSwarmSyncStateView(event)
	};
};

export const actions: Actions = {
	sync: async (event) => {
		await requireAdminSession(event);

		try {
			const result = await syncRecentSwarmCheckins(event, {
				limit: 20,
				includePhotos: false
			});
			return {
				ok: true,
				message: `Synced ${result.imported} check-ins${result.failed ? `, with ${result.failed} failures` : ''}.`,
				result
			};
		} catch (syncError) {
			return fail(500, {
				ok: false,
				message:
					syncError instanceof Error ? syncError.message : 'Unable to sync recent Swarm check-ins.'
			});
		}
	},
	disconnect: async (event) => {
		await requireAdminSession(event);
		await clearSwarmConnection(event);

		return {
			ok: true,
			message: 'Swarm connection removed.'
		};
	}
};
