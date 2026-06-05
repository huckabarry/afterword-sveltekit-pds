import { getSiteProfile } from '$lib/server/profile';
import { isSimpleSiteHost } from '$lib/simple-site';
import { getConfiguredStandardSitePublicationAtUri } from '$lib/server/standard-site';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const hostname = event.url.hostname;
	const [profile, standardSitePublicationAtUri] = await Promise.all([
		getSiteProfile(event),
		getConfiguredStandardSitePublicationAtUri(event)
	]);

	return {
		hostname,
		pathname: event.url.pathname,
		profile,
		standardSitePublicationAtUri,
		simpleSite: isSimpleSiteHost(hostname)
	};
};
