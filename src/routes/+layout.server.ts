import { getSiteProfile } from '$lib/server/profile';
import { getCmsShell } from '$lib/server/site-cms';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const [profile, cms] = await Promise.all([getSiteProfile(event), getCmsShell(event)]);

	return {
		pathname: event.url.pathname,
		profile,
		cms
	};
};
