import { fail } from '@sveltejs/kit';
import {
	formatVerificationLinksInput,
	getSiteProfile,
	parseVerificationLinksInput,
	updateSiteProfile
} from '$lib/server/profile';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const profile = await getSiteProfile(event);

	return {
		profile,
		verificationLinksInput: formatVerificationLinksInput(profile.verificationLinks),
		saved: event.url.searchParams.get('saved') === '1'
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const displayName = String(form.get('displayName') || '').trim();
		const avatarUrl = String(form.get('avatarUrl') || '').trim();
		const headerImageUrl = String(form.get('headerImageUrl') || '').trim();
		const bio = String(form.get('bio') || '').trim();
		const verificationLinksInput = String(form.get('verificationLinks') || '');

		if (!displayName || !avatarUrl || !bio) {
			return fail(400, {
				error: 'Display name, avatar URL, and bio are required.',
				displayName,
				avatarUrl,
				headerImageUrl,
				bio,
				verificationLinksInput
			});
		}

		await updateSiteProfile(event, {
			displayName,
			avatarUrl,
			headerImageUrl: headerImageUrl || null,
			bio,
			verificationLinks: parseVerificationLinksInput(verificationLinksInput)
		});

		return {
			success: true,
			displayName,
			avatarUrl,
			headerImageUrl,
			bio,
			verificationLinksInput
		};
	}
};
