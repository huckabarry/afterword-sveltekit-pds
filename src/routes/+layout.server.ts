import { getSiteProfile } from '$lib/server/profile';
import { getSanitySiteShell } from '$lib/server/sanity-site';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const [profile, sanitySiteShell] = await Promise.all([
		getSiteProfile(event),
		getSanitySiteShell()
	]);

	return {
		pathname: event.url.pathname,
		profile: {
			...profile,
			...sanitySiteShell?.profilePatch,
			verificationLinks:
				sanitySiteShell?.profilePatch.verificationLinks?.length
					? sanitySiteShell.profilePatch.verificationLinks
					: profile.verificationLinks
		},
		siteTitle: sanitySiteShell?.siteTitle || 'Afterword',
		siteDescription:
			sanitySiteShell?.siteDescription ||
			'Short updates, photos, and longer reflections on place, music, design, and daily life.',
		primaryNavLinks: sanitySiteShell?.primaryNavLinks || [],
		secondaryNavLinks: sanitySiteShell?.secondaryNavLinks || [],
		footerNavLinks: sanitySiteShell?.footerNavLinks || []
	};
};
