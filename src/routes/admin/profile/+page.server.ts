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
import { deliverMoveToFollowers, resolveMoveTarget } from '$lib/server/activitypub-move';
import { uploadImageFiles } from '$lib/server/media';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const profile = await getSiteProfile(event);

	return {
		profile,
		aboutInterestsInput: formatAboutInterestsInput(profile.aboutInterests),
		verificationLinksInput: formatVerificationLinksInput(profile.verificationLinks),
		migrationAliasesInput: formatMigrationAliasesInput(profile.migrationAliases),
		moveTargetHandleInput: profile.moveTargetHandle || '',
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
		const moveTargetHandleInput = String(form.get('moveTargetHandle') || '').trim();
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
				moveTargetHandleInput,
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

		let moveTargetHandle: string | null = null;
		let moveTargetActorUrl: string | null = null;
		let moveStartedAt: string | null = null;

		if (moveTargetHandleInput) {
			if (
				moveTargetHandleInput === currentProfile.moveTargetHandle &&
				currentProfile.moveTargetActorUrl
			) {
				moveTargetHandle = currentProfile.moveTargetHandle;
				moveTargetActorUrl = currentProfile.moveTargetActorUrl;
				moveStartedAt = currentProfile.moveStartedAt;
			} else {
				try {
					const resolvedTarget = await resolveMoveTarget(moveTargetHandleInput);
					moveTargetHandle = resolvedTarget.handle || moveTargetHandleInput;
					moveTargetActorUrl = resolvedTarget.actorUrl;
					moveStartedAt =
						resolvedTarget.actorUrl === currentProfile.moveTargetActorUrl
							? currentProfile.moveStartedAt
							: null;
				} catch (moveError) {
					return fail(400, {
						error:
							moveError instanceof Error
								? moveError.message
								: 'Unable to resolve the move target account.',
						displayName,
						avatarUrl: finalAvatarUrl || currentProfile.avatarUrl,
						headerImageUrl: finalHeaderImageUrl || '',
						bio,
						aboutBody,
						aboutInterestsInput,
						verificationLinksInput,
						migrationAliasesInput,
						moveTargetHandleInput,
						removeAvatar: false,
						removeHeaderImage: false
					});
				}
			}
		}

		const savedProfile = await updateSiteProfile(event, {
			displayName,
			avatarUrl: finalAvatarUrl,
			headerImageUrl: finalHeaderImageUrl,
			bio,
			aboutBody,
			aboutInterests: parseAboutInterestsInput(aboutInterestsInput),
			verificationLinks: parseVerificationLinksInput(verificationLinksInput),
			migrationAliases: parseMigrationAliasesInput(migrationAliasesInput),
			moveTargetHandle,
			moveTargetActorUrl,
			moveStartedAt
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
			moveTargetHandleInput: savedProfile.moveTargetHandle || '',
			moveTargetActorUrl: savedProfile.moveTargetActorUrl || '',
			moveStartedAt: savedProfile.moveStartedAt || '',
			removeAvatar: false,
			removeHeaderImage: false
		};
	},
	moveFollowers: async (event) => {
		const currentProfile = await getSiteProfile(event);

		if (!currentProfile.moveTargetActorUrl) {
			return fail(400, {
				moveError:
					'Save the new ActivityPub account handle first so the actor URL can be resolved.'
			});
		}

		const moveStartedAt = currentProfile.moveStartedAt || new Date().toISOString();

		if (!currentProfile.moveStartedAt) {
			await updateSiteProfile(event, {
				...currentProfile,
				moveStartedAt
			});
		}

		try {
			const delivery = await deliverMoveToFollowers(event, {
				targetActorUrl: currentProfile.moveTargetActorUrl,
				moveStartedAt,
				skipDelivered: true
			});

			return {
				moveSuccess: true,
				moveTargetHandle: currentProfile.moveTargetHandle,
				moveTargetHandleInput: currentProfile.moveTargetHandle || '',
				moveTargetActorUrl: currentProfile.moveTargetActorUrl,
				moveStartedAt,
				moveDelivered: delivery.results.filter((result) => result.status === 'delivered').length,
				moveAlreadyDelivered: delivery.results.filter(
					(result) => result.status === 'already-delivered'
				).length,
				moveFailed: delivery.results.filter((result) => result.status === 'failed').length,
				moveSkipped: delivery.results.filter((result) => result.status === 'skipped').length,
				moveFollowerCount: delivery.followerCount
			};
		} catch (moveError) {
			return fail(500, {
				moveError:
					moveError instanceof Error
						? moveError.message
						: 'Unable to deliver the Move activity to followers.'
			});
		}
	}
};
