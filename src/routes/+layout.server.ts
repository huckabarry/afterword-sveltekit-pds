import { getSiteProfile } from '$lib/server/profile';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	return {
		pathname: event.url.pathname,
		profile: await getSiteProfile(event)
	};
};
