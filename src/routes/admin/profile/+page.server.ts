import { fail } from '@sveltejs/kit';
import {
	formatAboutInterestsInput,
	formatMigrationAliasesInput,
	formatVerificationLinksInput,
	getSiteProfile,
	parseAboutInterestsInput,
	parseMigrationAliasesInput,
	parseVerificationLinksInput,
	updateSiteProfile
} from '$lib/server/profile';
import { uploadImageFiles } from '$lib/server/media';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const profile = await getSiteProfile(event);

	return {
		profile,
		aboutInterestsInput: formatAboutInterestsInput(profile.aboutInterests),
		verificationLinksInput: formatVerificationLinksInput(profile.verificationLinks),
		migrationAliasesInput: formatMigrationAliasesInput(profile.migrationAliases),
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
		const aboutBody = String(form.get('aboutBody') || '').trim();
		const aboutInterestsInput = String(form.get('aboutInterests') || '');
		const verificationLinksInput = String(form.get('verificationLinks') || '');
		const migrationAliasesInput = String(form.get('migrationAliases') || '');
		const avatarFile = form.get('avatarFile');
		const headerFile = form.get('headerFile');

		if (!displayName || !avatarUrl || !bio) {
			return fail(400, {
				error: 'Display name, avatar URL, and bio are required.',
				displayName,
				avatarUrl,
				headerImageUrl,
				bio,
				aboutBody,
				aboutInterestsInput,
				verificationLinksInput,
				migrationAliasesInput
			});
		}

		const [uploadedAvatar] =
			avatarFile instanceof File && avatarFile.size > 0
				? await uploadImageFiles(event, [avatarFile], {
						scope: 'profile',
						prefix: 'avatar'
					})
				: [];
		const [uploadedHeader] =
			headerFile instanceof File && headerFile.size > 0
				? await uploadImageFiles(event, [headerFile], {
						scope: 'profile',
						prefix: 'header'
					})
				: [];

		await updateSiteProfile(event, {
			displayName,
			avatarUrl: uploadedAvatar?.url || avatarUrl,
			headerImageUrl: uploadedHeader?.url || headerImageUrl || null,
			bio,
			aboutBody,
			aboutInterests: parseAboutInterestsInput(aboutInterestsInput),
			verificationLinks: parseVerificationLinksInput(verificationLinksInput),
			migrationAliases: parseMigrationAliasesInput(migrationAliasesInput)
		});

		return {
			success: true,
			displayName,
			avatarUrl: uploadedAvatar?.url || avatarUrl,
			headerImageUrl: uploadedHeader?.url || headerImageUrl,
			bio,
			aboutBody,
			aboutInterestsInput,
			verificationLinksInput,
			migrationAliasesInput
		};
	}
};
