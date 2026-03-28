import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { buildLocalAccount } from '$lib/server/mastodon-api';
import { getSiteProfile, updateSiteProfile } from '$lib/server/profile';
import { uploadImageFiles } from '$lib/server/media';

export async function PATCH(event) {
	await requireMastodonAccessToken(event);

	const profile = await getSiteProfile(event);
	const formData = await event.request.formData().catch(() => null);
	if (!formData) {
		return json({ error: 'Multipart form data is required.' }, { status: 400 });
	}

	const avatarInput = formData.get('avatar');
	const headerInput = formData.get('header');
	const avatarUploads =
		avatarInput && typeof avatarInput === 'object' && 'arrayBuffer' in avatarInput
			? await uploadImageFiles(event, [avatarInput as File], { scope: 'profile', prefix: 'avatar' })
			: [];
	const headerUploads =
		headerInput && typeof headerInput === 'object' && 'arrayBuffer' in headerInput
			? await uploadImageFiles(event, [headerInput as File], { scope: 'profile', prefix: 'header' })
			: [];

	await updateSiteProfile(event, {
		displayName: String(formData.get('display_name') || profile.displayName).trim() || profile.displayName,
		avatarUrl: avatarUploads[0]?.url || profile.avatarUrl,
		headerImageUrl: headerUploads[0]?.url || profile.headerImageUrl,
		bio: String(formData.get('note') || profile.bio).trim() || profile.bio,
		aboutBody: profile.aboutBody,
		aboutInterests: profile.aboutInterests,
		verificationLinks: profile.verificationLinks,
		migrationAliases: profile.migrationAliases,
		moveTargetHandle: profile.moveTargetHandle,
		moveTargetActorUrl: profile.moveTargetActorUrl,
		moveStartedAt: profile.moveStartedAt
	});

	return json(await buildLocalAccount(event));
}
