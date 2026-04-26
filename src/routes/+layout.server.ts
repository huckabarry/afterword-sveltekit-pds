import { getSiteProfile } from '$lib/server/profile';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const profile = await getSiteProfile(event);

	return {
		pathname: event.url.pathname,
		profile
	};
};
