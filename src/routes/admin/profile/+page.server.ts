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
		const currentProfile = await getSiteProfile(event);
		const form = await event.request.formData();
		const displayName = String(form.get('displayName') || '').trim();
		const bio = String(form.get('bio') || '').trim();
		const aboutBody = String(form.get('aboutBody') || '').trim();
		const aboutInterestsInput = String(form.get('aboutInterests') || '');
		const verificationLinksInput = String(form.get('verificationLinks') || '');
		const migrationAliasesInput = String(form.get('migrationAliases') || '');
		const removeAvatar = String(form.get('removeAvatar') || '') === '1';
		const removeHeaderImage = String(form.get('removeHeaderImage') || '') === '1';
		const avatarFile = form.get('avatarFile');
		const headerFile = form.get('headerFile');

		if (!displayName || !bio) {
			return fail(400, {
				error: 'Display name and bio are required.',
				displayName,
				avatarUrl: currentProfile.avatarUrl,
				headerImageUrl: currentProfile.headerImageUrl || '',
				bio,
				aboutBody,
				aboutInterestsInput,
				verificationLinksInput,
				migrationAliasesInput,
				removeAvatar,
				removeHeaderImage
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

		const finalAvatarUrl = uploadedAvatar?.url || (removeAvatar ? '' : currentProfile.avatarUrl);
		const finalHeaderImageUrl =
			uploadedHeader?.url || (removeHeaderImage ? null : currentProfile.headerImageUrl);

		const savedProfile = await updateSiteProfile(event, {
			displayName,
			avatarUrl: finalAvatarUrl,
			headerImageUrl: finalHeaderImageUrl,
			bio,
			aboutBody,
			aboutInterests: parseAboutInterestsInput(aboutInterestsInput),
			verificationLinks: parseVerificationLinksInput(verificationLinksInput),
			migrationAliases: parseMigrationAliasesInput(migrationAliasesInput)
		});

		return {
			success: true,
			displayName: savedProfile.displayName,
			avatarUrl: savedProfile.avatarUrl,
			headerImageUrl: savedProfile.headerImageUrl || '',
			bio: savedProfile.bio,
			aboutBody: savedProfile.aboutBody,
			aboutInterestsInput,
			verificationLinksInput,
			migrationAliasesInput,
			removeAvatar: false,
			removeHeaderImage: false
		};
	}
};
