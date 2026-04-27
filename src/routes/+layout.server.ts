import { getSiteProfile } from '$lib/server/profile';
import { isSimpleSiteHost } from '$lib/simple-site';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const profile = await getSiteProfile(event);
	const hostname = event.url.hostname;

	return {
		hostname,
		pathname: event.url.pathname,
		profile,
		simpleSite: isSimpleSiteHost(hostname)
	};
};
